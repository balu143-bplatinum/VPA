import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import {
  doc, getDoc, collection, addDoc, getDocs, setDoc,
  serverTimestamp, updateDoc, query, where
} from 'firebase/firestore';
import * as XLSX from 'xlsx';

// ─── EmailJS Configuration ────────────────────────────────────────────────────
const EMAILJS_SERVICE_ID = 'service_eftc1mu';
const EMAILJS_TEMPLATE_ID_USER = 'template_a2334ce';   
const EMAILJS_TEMPLATE_ID_ADMIN = 'template_gjl6mvg'; 
const EMAILJS_PUBLIC_KEY = 'n6tkxamp3KbeNSLsK';
const EMAILJS_PRIVATE_KEY = 'ZaxfMIfASNdlQki9ZHith'; 

const sendEmail = async (templateId, templateParams) => {
  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: templateId,
        user_id: EMAILJS_PUBLIC_KEY,
        accessToken: EMAILJS_PRIVATE_KEY,
        template_params: templateParams,
      }),
    });
    
    if (res.status !== 200) {
      const text = await res.text();
      console.error(`EmailJS API Error Response (${res.status}):`, text);
    }
    
    return res.status === 200;
  } catch (e) {
    console.error('EmailJS transmission error:', e);
    return false;
  }
};

const generateTicketNumber = () => {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `VPA-TKT-${ts}-${rand}`;
};

// ─── Government Portal Configuration ──────────────────────────────────────────
const PORTAL_CONFIG = {
  logoUrl: "/favicon-round.jpg",
  organizationName: "VISAKHAPATNAM PORT AUTHORITY",
  subTitle: "विशाखापट्टनम पोर्ट प्राधिकरण",
  ministryLabel: "भारत सरकार · पत्तन, पोत परिवहन और जलमार्ग मंत्रालय",
  portalTypeLabel: "INTEGRATED HUMAN RESOURCE MANAGEMENT SYSTEM (I-HRMS)",
  footerText: "© 2026 Visakhapatnam Port Authority | Information Technology Division | Government of India Initiative",
};

const REQUEST_CATEGORIES = [
  'Email Updation',
  'E-Office Related',
  'Personal Details',
  'Website Related',
  'Other',
];

const EMPLOYEE_STATUS_OPTIONS = ['Permanent', 'Contract', 'Trainee', 'Intern', 'Other'];
const GENDER_OPTIONS = ['Male', 'Female', 'Other'];
const NATIONALITY_OPTIONS = ['Indian', 'Other'];

// ─── Government Design Components ──────────────────────────────────────────────
const InfoRow = ({ label, value }) => (
  <div className="grid grid-cols-5 border-b border-gray-200 py-3 last:border-0 hover:bg-gray-50/50 px-2">
    <span className="col-span-2 text-xs font-bold uppercase tracking-wider text-gray-600 font-sans">{label}</span>
    <span className="col-span-3 text-sm font-semibold text-gray-900 font-sans">
      {value || <span className="italic text-gray-400 font-normal text-xs">Not Provided / रिक्त</span>}
    </span>
  </div>
);

const SectionCard = ({ title, color = 'blue', children }) => {
  const colors = {
    blue: 'border-l-4 border-l-[#0A2540] bg-gray-100 border-b border-r border-t border-gray-300',
    amber: 'border-l-4 border-l-[#B38F00] bg-gray-100 border-b border-r border-t border-gray-300',
    green: 'border-l-4 border-l-emerald-700 bg-gray-100 border-b border-r border-t border-gray-300',
    indigo: 'border-l-4 border-l-indigo-900 bg-gray-100 border-b border-r border-t border-gray-300',
    red: 'border-l-4 border-l-red-800 bg-gray-100 border-b border-r border-t border-gray-300',
    slate: 'border-l-4 border-l-gray-700 bg-gray-100 border-b border-r border-t border-gray-300',
  };
  return (
    <div className="bg-white shadow-sm overflow-hidden border border-gray-300 rounded-none mb-4">
      <div className={`${colors[color]} px-4 py-2.5`}>
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-800 font-sans">{title}</h4>
      </div>
      <div className="p-4 bg-white border-t border-gray-200">{children}</div>
    </div>
  );
};

const Badge = ({ status }) => {
  const map = {
    'Pending': 'bg-amber-100 border-amber-400 text-amber-900 font-black',
    'In Progress': 'bg-blue-100 border-blue-400 text-blue-950 font-black',
    'Resolved': 'bg-emerald-100 border-emerald-400 text-emerald-950 font-black',
    'Rejected': 'bg-red-100 border-red-400 text-red-900 font-black',
  };
  const cls = map[status] || 'bg-gray-100 border-gray-400 text-gray-900';
  return (
    <span className={`inline-block border px-2 py-0.5 text-[11px] uppercase tracking-wide font-sans ${cls}`}>
      {status}
    </span>
  );
};

// ─── Main Application Logic ───────────────────────────────────────────────────
export default function App() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userData, setUserData] = useState(null);

  const [userPage, setUserPage] = useState('profile');       
  const [adminTab, setAdminTab] = useState('enroll');        
  const [enrollMode, setEnrollMode] = useState('manual');    

  const [allUsers, setAllUsers] = useState([]);
  const [allAmendments, setAllAmendments] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedAmendment, setSelectedAmendment] = useState(null);
  const [searchUserQuery, setSearchUserQuery] = useState('');
  
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editedUserData, setEditedUserData] = useState(null);

  // Complete master mapping architecture of exactly 22 fields
  const emptyEmp = {
    username: '', password: '', role: 'employee',
    fullName: '', gender: '', dob: '', nationality: 'Indian',
    address: '', phone: '', email: '', emergencyContact: '',
    aadhar: '', passport: '', pan: '', otherGovtId: '',
    designation: '', department: '', employeeStatus: 'Permanent', joiningDate: '',
    bankAccountNo: '', bankName: '', ifscCode: '', bankBranch: '',
  };
  const [newEmp, setNewEmp] = useState({ ...emptyEmp });
  const [enrollSuccess, setEnrollSuccess] = useState('');

  const [reqCategory, setReqCategory] = useState(REQUEST_CATEGORIES[0]);
  const [reqDetails, setReqDetails] = useState('');
  const [ticketResult, setTicketResult] = useState(null);
  const [reqLoading, setReqLoading] = useState(false);

  const [statusQuery, setStatusQuery] = useState('');
  const [statusResult, setStatusResult] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState('');

  const [adminSelectedStatus, setAdminSelectedStatus] = useState('Pending');
  const [resolveNotes, setResolveNotes] = useState('');
  const [resolveLoading, setResolveLoading] = useState(false);

  const fetchAdminData = async () => {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      setAllUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      const amendSnap = await getDocs(collection(db, 'amendments'));
      setAllAmendments(amendSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Fetch error:', err);
    }
  };

  useEffect(() => {
    if (isLoggedIn && isAdmin) fetchAdminData();
  }, [isLoggedIn, isAdmin]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);
    try {
      const snap = await getDoc(doc(db, 'users', userId.trim()));
      if (snap.exists()) {
        const data = snap.data();
        if (data.password === password) {
          setUserData(data);
          setIsLoggedIn(true);
          setIsAdmin(data.role === 'admin');
        } else {
          setErrorMessage('Authentication Failed: Invalid Password.');
        }
      } else {
        setErrorMessage('Authentication Failed: Invalid ID / Password ');
      }
    } catch (err) {
      setErrorMessage('System Communication Error: Connection timed out.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = () => {
    setIsLoggedIn(false); setIsAdmin(false);
    setUserId(''); setPassword(''); setUserData(null);
    setUserPage('profile'); setAdminTab('enroll');
    setSelectedUser(null); setSelectedAmendment(null);
    setTicketResult(null); setStatusResult(null);
    setIsEditingUser(false); setEditedUserData(null);
    setSearchUserQuery('');
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    if (!reqDetails.trim()) return;
    setReqLoading(true);
    try {
      const ticketNo = generateTicketNumber();
      await addDoc(collection(db, 'amendments'), {
        ticketNo,
        employeeId: userData.username,
        employeeName: userData.fullName,
        employeeEmail: userData.email,
        category: reqCategory,
        details: reqDetails,
        status: 'Pending',
        resolveNotes: '',
        submittedAt: serverTimestamp(),
      });

      await sendEmail(EMAILJS_TEMPLATE_ID_USER, {
        to_name: userData.fullName,
        email: userData.email,
        ticket_id: ticketNo,                 
        classification_type: reqCategory,    
        tracking_url: "https://vpa-portal.gov.in/track", 
        details: reqDetails,
        organization: PORTAL_CONFIG.organizationName,
      });

      setTicketResult(ticketNo);
      setReqDetails('');
    } catch (err) {
      console.error(err);
      alert('Error submitting dispatch record.');
    } finally {
      setReqLoading(false);
    }
  };

  const handleStatusCheck = async (e) => {
    e.preventDefault();
    setStatusLoading(true);
    setStatusError('');
    setStatusResult(null);
    try {
      const q = query(collection(db, 'amendments'), where('ticketNo', '==', statusQuery.trim()));
      const snap = await getDocs(q);
      if (snap.empty) {
        setStatusError('No active files matched the specified reference key.');
      } else {
        setStatusResult({ id: snap.docs[0].id, ...snap.docs[0].data() });
      }
    } catch (err) {
      setStatusError('Database lookup failure.');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    const empId = newEmp.username.trim();
    if (!empId) return alert('System Master Record Identification Number required.');
    try {
      await setDoc(doc(db, 'users', empId), { ...newEmp, username: empId });
      setEnrollSuccess(`Personnel Entry "${newEmp.fullName}" successfully recorded.`);
      setNewEmp({ ...emptyEmp });
      fetchAdminData();
      setTimeout(() => setEnrollSuccess(''), 5000);
    } catch (err) {
      alert('Write verification failure.');
    }
  };

  const handleUpdateEmployeeDetails = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'users', editedUserData.username), editedUserData);
      alert('Official database record altered successfully.');
      setSelectedUser(editedUserData);
      setIsEditingUser(false);
      fetchAdminData();
    } catch (err) {
      alert('Failed to execute write transaction.');
    }
  };

  // ─── Optimized Multi-Field Parallel Excel Enrollment Engine ───────────────────
  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws);
        let count = 0;
        
        for (const row of rows) {
          // Robust column configuration matching strategies across common formatting styles
          const empId = (row.username || row.EmployeeID || row.employeeId || row['Employee ID'] || '').toString().trim();
          if (!empId) continue;
          
          await setDoc(doc(db, 'users', empId), {
            // 1-5 Basic Access Keys
            username: empId,
            password: (row.password || row.Password || 'vpa123').toString().trim(),
            role: (row.role || row.Role || 'employee').toString().trim(),
            fullName: (row.fullName || row.FullName || row['Full Name'] || '').toString().trim().toUpperCase(),
            gender: (row.gender || row.Gender || '').toString().trim(),
            
            // 6-10 Personal Details
            dob: (row.dob || row.DOB || row['Date of Birth'] || '').toString().trim(),
            nationality: (row.nationality || row.Nationality || 'Indian').toString().trim(),
            address: (row.address || row.Address || row['Residential Address'] || '').toString().trim(),
            phone: (row.phone || row.Phone || row['Phone Number'] || '').toString().trim(),
            email: (row.email || row.Email || row['Email Address'] || '').toString().trim(),
            
            // 11-15 Security & National Identifiers
            emergencyContact: (row.emergencyContact || row.EmergencyContact || row['Emergency Contact'] || '').toString().trim(),
            aadhar: (row.aadhar || row.Aadhar || row.Aadhaar || row['Aadhaar Number'] || '').toString().trim(),
            passport: (row.passport || row.Passport || row['Passport Number'] || '').toString().trim().toUpperCase(),
            pan: (row.pan || row.PAN || row['PAN Number'] || '').toString().trim().toUpperCase(),
            otherGovtId: (row.otherGovtId || row.OtherGovtId || row['Other ID'] || '').toString().trim(),
            
            // 16-18 Structural Employment Records
            designation: (row.designation || row.Designation || '').toString().trim(),
            department: (row.department || row.Department || '').toString().trim(),
            employeeStatus: (row.employeeStatus || row.EmployeeStatus || row['Employment Status'] || 'Permanent').toString().trim(),
            joiningDate: (row.joiningDate || row.JoiningDate || row['Joining Date'] || '').toString().trim(),
            
            // 19-22 Bank Account Records Allocation
            bankAccountNo: (row.bankAccountNo || row.BankAccountNo || row['Account Number'] || '').toString().trim(),
            bankName: (row.bankName || row.BankName || row['Bank Name'] || '').toString().trim(),
            ifscCode: (row.ifscCode || row.IfscCode || row['IFSC Code'] || '').toString().trim().toUpperCase(),
            bankBranch: (row.bankBranch || row.BankBranch || row['Branch Location'] || '').toString().trim(),
          });
          count++;
        }
        alert(`Bulk Registration Matrix Synchronized: ${count} complete employee profiles compiled into database files.`);
        fetchAdminData();
        e.target.value = null;
      } catch (err) {
        console.error(err);
        alert('Data parsing abort: Document architecture configuration structural layout mismatch.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleUpdateTicketStatus = async (amendment) => {
    setResolveLoading(true);
    try {
      await updateDoc(doc(db, 'amendments', amendment.id), {
        status: adminSelectedStatus,
        resolveNotes,
        resolvedAt: serverTimestamp(),
      });

      let statusMessage = '';
      let statusHindi = '';
      let themeColor = '#059669';       
      let statusBadgeBg = '#F0FDF4';    
      let statusBadgeColor = '#166534'; 
      let statusBorderColor = '#BBF7D0'; 

      if (adminSelectedStatus === 'In Progress') {
        statusMessage = 'Your request has been reviewed and is currently In Progress / Under Review.';
        statusHindi = 'आपका अनुरोध वर्तमान में प्रगति पर है और इसकी समीक्षा की जा रही है।';
        themeColor = '#2563EB';         
        statusBadgeBg = '#EFF6FF';      
        statusBadgeColor = '#1E40AF';   
        statusBorderColor = '#BFDBFE';  
      } else if (adminSelectedStatus === 'Resolved') {
        statusMessage = 'The ticket problem has been successfully solved / completed.';
        statusHindi = 'अनुरोधित समस्या का सफलतापूर्वक समाधान कर दिया गया है।';
        themeColor = '#059669';         
        statusBadgeBg = '#F0FDF4';
        statusBadgeColor = '#166534';
        statusBorderColor = '#BBF7D0';
      } else if (adminSelectedStatus === 'Rejected') {
        statusMessage = 'The request has been rejected based on administrative verification.';
        statusHindi = 'प्रशासनिक सत्यापन और नियमों के आधार पर अनुरोध अस्वीकार कर दिया गया है।';
        themeColor = '#DC2626';         
        statusBadgeBg = '#FEF2F2';      
        statusBadgeColor = '#991B1B';   
        statusBorderColor = '#FCA5A5';  
      } else {
        statusMessage = 'Your request is currently marked as Pending.';
        statusHindi = 'आपका अनुरोध वर्तमान में लंबित है।';
        themeColor = '#D97706';         
        statusBadgeBg = '#FFFBEB';
        statusBadgeColor = '#92400E';
        statusBorderColor = '#FDE68A';
      }

      await sendEmail(EMAILJS_TEMPLATE_ID_ADMIN, {
        to_name: amendment.employeeName,
        email: amendment.employeeEmail,
        ticket_no: amendment.ticketNo,
        category: amendment.category,
        original_request: amendment.details,
        status: adminSelectedStatus,
        status_hindi: statusHindi,
        theme_color: themeColor,
        status_badge_bg: statusBadgeBg,
        status_badge_color: statusBadgeColor,
        status_border_color: statusBorderColor,
        resolve_notes: statusMessage + (resolveNotes ? `\n\nOfficial Remarks: ${resolveNotes}` : ''),
        organization: PORTAL_CONFIG.organizationName,
      });

      setResolveNotes('');
      setSelectedAmendment(null);
      fetchAdminData();
      alert(`File updated successfully to: ${adminSelectedStatus} & Employee Notified`);
    } catch (err) {
      console.error("Transmission Failure:", err);
      alert('Status alteration execution error.');
    } finally {
      setResolveLoading(false);
    }
  };

  const ticketCountFor = (empId) =>
    allAmendments.filter(a => a.employeeId === empId).length;

  const filteredEmployees = allUsers.filter(u => {
    if (u.role === 'admin') return false;
    const matchQuery = searchUserQuery.toLowerCase().trim();
    const matchId = (u.username || '').toLowerCase();
    const matchName = (u.fullName || '').toLowerCase();
    return matchId.includes(matchQuery) || matchName.includes(matchQuery);
  });

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F4F6F9] font-sans text-gray-900 antialiased">
        <div className="w-full flex h-1.5">
          <div className="flex-1 bg-[#FF9933]" />
          <div className="flex-1 bg-white" />
          <div className="flex-1 bg-[#138808]" />
        </div>
        
        <div className="bg-[#0A2540] text-[#FFFFFF] py-2 text-[11px] font-bold tracking-wider px-4 flex justify-between items-center border-b border-gray-700">
          <div>MINISTRY OF PORTS, SHIPPING AND WATERWAYS · GOVERNMENT OF INDIA</div>
          <div className="hidden md:block text-right text-gray-300">{PORTAL_CONFIG.ministryLabel}</div>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-lg">
            <div className="bg-white border border-gray-300 border-b-0 p-6 shadow-sm text-center">
              <div className="flex justify-center items-center gap-5 mb-4">
                <img src={PORTAL_CONFIG.logoUrl} alt="VPA Logo" className="h-24 w-24 rounded-full object-contain bg-white p-2 border border-gray-200 shadow-md" />
                <div className="text-left border-l border-gray-300 pl-4">
                  <h1 className="text-lg font-black tracking-tight text-[#0A2540] leading-none mb-1">
                    {PORTAL_CONFIG.organizationName}
                  </h1>
                  <p className="text-md font-bold text-[#B38F00] tracking-wide">{PORTAL_CONFIG.subTitle}</p>
                </div>
              </div>
              <div className="bg-gray-100 border border-gray-300 py-1.5 px-3 text-[11px] font-bold tracking-wider text-gray-700 uppercase">
                {PORTAL_CONFIG.portalTypeLabel}
              </div>
            </div>

            <div className="bg-white border border-gray-300 p-6 border-t-2 border-t-[#B38F00] shadow-md">
              <div className="border-b border-gray-200 pb-3 mb-5 text-center">
                <h2 className="text-xs font-black text-[#0A2540] tracking-widest uppercase">VPA EMPLOYEE LOGIN</h2>
              </div>
              
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Employee ID <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={userId}
                    onChange={e => setUserId(e.target.value)}
                    placeholder="e.g. VPA-202412"
                    className="w-full border border-gray-400 rounded-none bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#0A2540] focus:ring-1 focus:ring-[#0A2540] outline-none font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Password <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full border border-gray-400 rounded-none bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#0A2540] focus:ring-1 focus:ring-[#0A2540] outline-none font-mono"
                    required
                  />
                </div>
                
                {errorMessage && (
                  <div className="border border-red-400 bg-red-50 px-3 py-2 text-xs font-bold text-red-800">
                    🔒 Security Fault: {errorMessage}
                  </div>
                )}
                
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full rounded-none bg-[#0A2540] py-2.5 text-xs font-black text-white tracking-widest uppercase hover:bg-slate-800 transition-colors border border-black disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? 'Verifying Credentials...' : 'Secure Login'}
                </button>
              </form>

              <div className="mt-5 border border-gray-200 bg-gray-50 px-3 py-2.5">
                <p className="text-[10px] text-gray-600 leading-relaxed text-center font-medium">
                  <strong>CONFIDENTIALITY NOTICE:</strong> This computing infrastructure is restricted to validated public sector functionaries. Unsanctioned attempts at system infiltration will invite punitive actions under the Information Technology Act.
                </p>
              </div>
            </div>

            <div className="bg-gray-100 border border-gray-300 border-t-0 py-3 text-center">
              <p className="text-[10px] text-gray-600 font-bold tracking-wide">{PORTAL_CONFIG.footerText}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoggedIn && isAdmin) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F4F6F9] font-sans text-gray-900">
        <div className="w-full flex h-1.5"><div className="flex-1 bg-[#FF9933]" /><div className="flex-1 bg-white" /><div className="flex-1 bg-[#138808]" /></div>

        <header className="bg-[#0A2540] text-white px-6 py-4 shadow-sm border-b border-gray-800">
          <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img src={PORTAL_CONFIG.logoUrl} alt="VPA" className="h-12 w-12 rounded-full object-contain bg-white p-1 border border-gray-200 shadow-sm" />
              <div>
                <h1 className="text-md font-black tracking-wide">{PORTAL_CONFIG.organizationName}</h1>
                <p className="text-[10px] font-bold text-[#B38F00] uppercase tracking-widest">Administrative Control Panel & Records Division</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="border border-gray-600 bg-slate-900/50 px-3 py-1 text-xs font-bold tracking-wider text-gray-300 font-mono">
                Operator: {userData.fullName}
              </span>
              <button
                onClick={handleSignOut}
                className="border border-red-700 bg-red-800 px-3 py-1 text-xs font-bold text-white hover:bg-red-900 transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>

        <div className="bg-white border-b border-gray-300 shadow-sm sticky top-0 z-50">
          <div className="mx-auto max-w-7xl px-6 flex flex-wrap gap-0">
            {[
              { key: 'enroll', label: '📋 Personnel Enrollment' },
              { key: 'employees', label: `👥 Master Data (${allUsers.filter(u => u.role !== 'admin').length})` },
              { key: 'requests', label: `📬 Requests (${allAmendments.filter(a => a.status === 'Pending').length} Open)` },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => { setAdminTab(tab.key); setSelectedUser(null); setIsEditingUser(false); }}
                className={`px-5 py-3.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${adminTab === tab.key ? 'border-b-2 border-b-[#0A2540] text-[#0A2540] bg-gray-50 font-black' : 'border-b-transparent text-gray-500 hover:text-gray-900'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 py-6">

          {/* ── ADMIN: ENROLL TAB ── */}
          {adminTab === 'enroll' && (
            <div>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setEnrollMode('manual')}
                  className={`px-4 py-1.5 text-xs font-bold border transition-colors cursor-pointer ${enrollMode === 'manual' ? 'bg-[#0A2540] text-white border-black' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}
                >
                  Manual Enrollment
                </button>
                <button
                  onClick={() => setEnrollMode('excel')}
                  className={`px-4 py-1.5 text-xs font-bold border transition-colors cursor-pointer ${enrollMode === 'excel' ? 'bg-[#0A2540] text-white border-black' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}
                >
                  Multiple enrollment
                </button>
              </div>

              {enrollMode === 'manual' && (
                <div className="bg-white border border-gray-300 shadow-sm">
                  <div className="bg-gray-100 border-b border-gray-300 px-5 py-3">
                    <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">EMPLOYEE ENROLLMENT FORM</h3>
                  </div>
                  <form onSubmit={handleAddEmployee} className="p-5 space-y-6">
                    {enrollSuccess && (
                      <div className="border border-emerald-400 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-900">
                        ✔ System Update: {enrollSuccess}
                      </div>
                    )}

                    <div>
                      <h4 className="text-[11px] font-black uppercase tracking-wider text-[#0A2540] border-b border-gray-300 pb-1 mb-3">EMPLOYEE LOGIN DETAILS</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                          { label: 'Employee ID *', field: 'username', placeholder: 'VPA-615328', type: 'text', required: true },
                          { label: 'Password *', field: 'password', placeholder: '••••••', type: 'text', required: true },
                        ].map(f => (
                          <div key={f.field}>
                            <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">{f.label}</label>
                            <input type={f.type} required={f.required} placeholder={f.placeholder} value={newEmp[f.field]} onChange={e => setNewEmp({ ...newEmp, [f.field]: e.target.value })} className="w-full border border-gray-400 bg-white px-3 py-1.5 text-xs text-gray-900 focus:border-[#0A2540] outline-none font-mono" />
                          </div>
                        ))}
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Category *</label>
                          <select value={newEmp.role} onChange={e => setNewEmp({ ...newEmp, role: e.target.value })} className="w-full border border-gray-400 bg-white px-3 py-1.5 text-xs text-gray-900 focus:border-[#0A2540] outline-none">
                            <option value="employee">Employee</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[11px] font-black uppercase tracking-wider text-[#0A2540] border-b border-gray-300 pb-1 mb-3">Personal Details</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                          { label: 'Full Name*', field: 'fullName', placeholder: 'SURNAME FIRST NAME', type: 'text', required: true },
                          { label: 'Date of Birth', field: 'dob', placeholder: 'YYYY-MM-DD', type: 'date' },
                        ].map(f => (
                          <div key={f.field}>
                            <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">{f.label}</label>
                            <input type={f.type} required={f.required} placeholder={f.placeholder} value={newEmp[f.field]} onChange={e => setNewEmp({ ...newEmp, [f.field]: e.target.value })} className="w-full border border-gray-400 bg-white px-3 py-1.5 text-xs text-gray-900 focus:border-[#0A2540] outline-none" />
                          </div>
                        ))}
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Gender</label>
                          <select value={newEmp.gender} onChange={e => setNewEmp({ ...newEmp, gender: e.target.value })} className="w-full border border-gray-400 bg-white px-3 py-1.5 text-xs text-gray-900 focus:border-[#0A2540] outline-none">
                            <option value="">Select</option>
                            {GENDER_OPTIONS.map(g => <option key={g}>{g}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Nationality</label>
                          <select value={newEmp.nationality} onChange={e => setNewEmp({ ...newEmp, nationality: e.target.value })} className="w-full border border-gray-400 bg-white px-3 py-1.5 text-xs text-gray-900 focus:border-[#0A2540] outline-none">
                            {NATIONALITY_OPTIONS.map(n => <option key={n}>{n}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[11px] font-black uppercase tracking-wider text-[#0A2540] border-b border-gray-300 pb-1 mb-3">Contact & Communications Details</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-3">
                          <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Permanent Residential Address</label>
                          <input type="text" placeholder="Full residential location details" value={newEmp.address} onChange={e => setNewEmp({ ...newEmp, address: e.target.value })} className="w-full border border-gray-400 bg-white px-3 py-1.5 text-xs text-gray-900 focus:border-[#0A2540] outline-none" />
                        </div>
                        {[
                          { label: 'Primary Phone Number', field: 'phone', placeholder: 'XXXXXXXXXX', type: 'text' },
                          { label: 'Correspondence Email *', field: 'email', placeholder: 'name@vpa.gov.in', type: 'email', required: true },
                          { label: 'Emergency Contact Info', field: 'emergencyContact', placeholder: 'Name / Phone', type: 'text' },
                        ].map(f => (
                          <div key={f.field}>
                            <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">{f.label}</label>
                            <input type={f.type} required={f.required} placeholder={f.placeholder} value={newEmp[f.field]} onChange={e => setNewEmp({ ...newEmp, [f.field]: e.target.value })} className="w-full border border-gray-400 bg-white px-3 py-1.5 text-xs text-gray-900 focus:border-[#0A2540] outline-none" />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[11px] font-black uppercase tracking-wider text-[#0A2540] border-b border-gray-300 pb-1 mb-3">Government Identification Details</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        {[
                          { label: 'Aadhaar Card ID', field: 'aadhar', placeholder: 'XXXX XXXX XXXX' },
                          { label: 'Passport Identification', field: 'passport', placeholder: 'AXXXXXXX' },
                          { label: 'Income Tax PAN ID', field: 'pan', placeholder: 'ABCDE1234F' },
                          { label: 'Other Validation ID', field: 'otherGovtId', placeholder: 'Voter ID / DL' },
                        ].map(f => (
                          <div key={f.field}>
                            <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">{f.label}</label>
                            <input type="text" placeholder={f.placeholder} value={newEmp[f.field]} onChange={e => setNewEmp({ ...newEmp, [f.field]: e.target.value })} className="w-full border border-gray-400 bg-white px-3 py-1.5 text-xs text-gray-900 focus:border-[#0A2540] outline-none font-mono" />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[11px] font-black uppercase tracking-wider text-[#0A2540] border-b border-gray-300 pb-1 mb-3">Employment Structure Records</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        {[
                          { label: 'Official Designation *', field: 'designation', placeholder: 'e.g., Senior Engineer', required: true },
                          { label: 'Assigned Department *', field: 'department', placeholder: 'e.g., Cargo Operations', required: true },
                          { label: 'Official Joining Date', field: 'joiningDate', placeholder: 'YYYY-MM-DD', required: false },
                        ].map(f => (
                          <div key={f.field}>
                            <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">{f.label}</label>
                            <input type="text" required={f.required} placeholder={f.placeholder} value={newEmp[f.field]} onChange={e => setNewEmp({ ...newEmp, [f.field]: e.target.value })} className="w-full border border-gray-400 bg-white px-3 py-1.5 text-xs text-gray-900 focus:border-[#0A2540] outline-none" />
                          </div>
                        ))}
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Employment Framework Status</label>
                          <select value={newEmp.employeeStatus} onChange={e => setNewEmp({ ...newEmp, employeeStatus: e.target.value })} className="w-full border border-gray-400 bg-white px-3 py-1.5 text-xs text-gray-900 focus:border-[#0A2540] outline-none">
                            {EMPLOYEE_STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[11px] font-black uppercase tracking-wider text-[#0A2540] border-b border-gray-300 pb-1 mb-3">Bank Account Details</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        {[
                          { label: 'Bank Account Number', field: 'bankAccountNo', placeholder: 'XXXXXXXXXXXXXX' },
                          { label: 'Financial Institution Name', field: 'bankName', placeholder: 'State Bank of India' },
                          { label: 'IFSC Routing Code', field: 'ifscCode', placeholder: 'SBIN0001234' },
                          { label: 'Bank Branch Location', field: 'bankBranch', placeholder: 'Visakhapatnam' },
                        ].map(f => (
                          <div key={f.field}>
                            <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">{f.label}</label>
                            <input type="text" placeholder={f.placeholder} value={newEmp[f.field]} onChange={e => setNewEmp({ ...newEmp, [f.field]: e.target.value })} className="w-full border border-gray-400 bg-white px-3 py-1.5 text-xs text-gray-900 focus:border-[#0A2540] outline-none font-mono" />
                          </div>
                        ))}
                      </div>
                    </div>

                    <button type="submit" className="w-full bg-[#0A2540] py-2.5 text-xs font-black text-white uppercase tracking-widest hover:bg-slate-800 transition-colors border border-black cursor-pointer">
                      ADD EMPLOYEE TO DB
                    </button>
                  </form>
                </div>
              )}

              {enrollMode === 'excel' && (
                <div className="bg-white border border-gray-300 shadow-sm p-6 text-center">
                  <h3 className="text-sm font-black text-[#0A2540] uppercase tracking-wider mb-2">MULTIPLE EMPLOYEE ENROLLMENT</h3>
                  <p className="text-xs text-gray-600 mb-6 max-w-xl mx-auto">
                    Select a structured layout spreadsheet template array for parallel record insertion directly to the central cloud server collection partition.
                  </p>
                  <div className="border-2 border-dashed border-gray-400 p-8 bg-gray-50 max-w-md mx-auto relative hover:bg-gray-100 transition-colors">
                    <input type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                    <span className="text-xs font-bold text-gray-500 font-mono block">📁 CHOOSE OR DRAG COMPATIBLE EXCEL SPREADSHEETS HERE</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── ADMIN: MASTER DOSSIER DIRECTORY TAB ── */}
          {adminTab === 'employees' && (
            <div className="space-y-4">
              {selectedUser ? (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <button 
                      onClick={() => { setSelectedUser(null); setIsEditingUser(false); }} 
                      className="text-xs font-bold text-[#0A2540] hover:underline flex items-center gap-1 cursor-pointer font-sans"
                    >
                      ← RETURN BACK 
                    </button>
                    
                    {!isEditingUser && (
                      <button 
                        onClick={() => { setEditedUserData({ ...selectedUser }); setIsEditingUser(true); }} 
                        className="bg-[#B38F00] text-white px-4 py-1.5 text-xs font-bold uppercase tracking-wider border border-black hover:bg-amber-600 transition-colors cursor-pointer font-sans"
                      >
                        ✏️ Edit Records
                      </button>
                    )}
                  </div>

                  {isEditingUser ? (
                    <div className="bg-white border border-gray-300 shadow-sm">
                      <div className="bg-[#B38F00] text-white px-5 py-3 font-black text-xs uppercase tracking-wider flex justify-between items-center">
                        <span>⚙️ MODIFYING MASTER RECORD: {editedUserData.username}</span>
                        <span className="text-[10px] bg-black/20 px-2 py-0.5 border border-white/20 font-mono">EDIT MODE</span>
                      </div>

                      <form onSubmit={handleUpdateEmployeeDetails} className="p-6 space-y-6">
                        <div>
                          <h4 className="text-[11px] font-black uppercase tracking-wider text-[#0A2540] border-b border-gray-300 pb-1 mb-3 font-sans">
                            1. Profile Information / व्यक्तिगत विवरण
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1">Full Name *</label>
                              <input 
                                type="text" 
                                value={editedUserData.fullName || ''} 
                                onChange={e => setEditedUserData({ ...editedUserData, fullName: e.target.value.toUpperCase() })} 
                                className="w-full border border-gray-400 bg-white p-2 text-xs text-gray-900 focus:border-[#0A2540] outline-none font-sans font-semibold" 
                                required 
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1">Gender *</label>
                              <select 
                                value={editedUserData.gender || ''} 
                                onChange={e => setEditedUserData({ ...editedUserData, gender: e.target.value })} 
                                className="w-full border border-gray-400 bg-white p-2 text-xs text-gray-900 focus:border-[#0A2540] outline-none"
                                required
                              >
                                <option value="">Select Gender</option>
                                {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1">Date of Birth *</label>
                              <input 
                                type="date" 
                                value={editedUserData.dob || ''} 
                                onChange={e => setEditedUserData({ ...editedUserData, dob: e.target.value })} 
                                className="w-full border border-gray-400 bg-white p-2 text-xs text-gray-900 focus:border-[#0A2540] outline-none font-mono" 
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1">Nationality *</label>
                              <select 
                                value={editedUserData.nationality || 'Indian'} 
                                onChange={e => setEditedUserData({ ...editedUserData, nationality: e.target.value })} 
                                className="w-full border border-gray-400 bg-white p-2 text-xs text-gray-900 focus:border-[#0A2540] outline-none"
                              >
                                {NATIONALITY_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-[11px] font-black uppercase tracking-wider text-[#0A2540] border-b border-gray-300 pb-1 mb-3 font-sans">
                            2. Contact Information / संपर्क विवरण
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="sm:col-span-3">
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1">Residential Address *</label>
                              <input 
                                type="text" 
                                value={editedUserData.address || ''} 
                                onChange={e => setEditedUserData({ ...editedUserData, address: e.target.value })} 
                                className="w-full border border-gray-400 bg-white p-2 text-xs text-gray-900 focus:border-[#0A2540] outline-none" 
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1">Phone No *</label>
                              <input 
                                type="text" 
                                value={editedUserData.phone || ''} 
                                onChange={e => setEditedUserData({ ...editedUserData, phone: e.target.value })} 
                                className="w-full border border-gray-400 bg-white p-2 text-xs text-gray-900 focus:border-[#0A2540] outline-none font-mono" 
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1">Email Address *</label>
                              <input 
                                type="email" 
                                value={editedUserData.email || ''} 
                                onChange={e => setEditedUserData({ ...editedUserData, email: e.target.value })} 
                                className="w-full border border-gray-400 bg-white p-2 text-xs text-gray-900 focus:border-[#0A2540] outline-none font-mono" 
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1">Emergency Contact Info *</label>
                              <input 
                                type="text" 
                                value={editedUserData.emergencyContact || ''} 
                                onChange={e => setEditedUserData({ ...editedUserData, emergencyContact: e.target.value })} 
                                className="w-full border border-gray-400 bg-white p-2 text-xs text-gray-900 focus:border-[#0A2540] outline-none" 
                                required
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-[11px] font-black uppercase tracking-wider text-[#0A2540] border-b border-gray-300 pb-1 mb-3 font-sans">
                            3. Govt Identification Details / सरकारी पहचान विवरण
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1">Aadhar Number</label>
                              <input 
                                type="text" 
                                value={editedUserData.aadhar || ''} 
                                onChange={e => setEditedUserData({ ...editedUserData, aadhar: e.target.value })} 
                                className="w-full border border-gray-400 bg-white p-2 text-xs text-gray-900 focus:border-[#0A2540] outline-none font-mono" 
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1">Passport Ref</label>
                              <input 
                                type="text" 
                                value={editedUserData.passport || ''} 
                                onChange={e => setEditedUserData({ ...editedUserData, passport: e.target.value.toUpperCase() })} 
                                className="w-full border border-gray-400 bg-white p-2 text-xs text-gray-900 focus:border-[#0A2540] outline-none font-mono" 
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1">PAN Card ID</label>
                              <input 
                                type="text" 
                                value={editedUserData.pan || ''} 
                                onChange={e => setEditedUserData({ ...editedUserData, pan: e.target.value.toUpperCase() })} 
                                className="w-full border border-gray-400 bg-white p-2 text-xs text-gray-900 focus:border-[#0A2540] outline-none font-mono" 
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1">Other Identification</label>
                              <input 
                                type="text" 
                                value={editedUserData.otherGovtId || ''} 
                                onChange={e => setEditedUserData({ ...editedUserData, otherGovtId: e.target.value })} 
                                className="w-full border border-gray-400 bg-white p-2 text-xs text-gray-900 focus:border-[#0A2540] outline-none" 
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-[11px] font-black uppercase tracking-wider text-[#0A2540] border-b border-gray-300 pb-1 mb-3 font-sans">
                            4. Employment Details / रोजगार विवरण
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1">Designation *</label>
                              <input 
                                type="text" 
                                value={editedUserData.designation || ''} 
                                onChange={e => setEditedUserData({ ...editedUserData, designation: e.target.value })} 
                                className="w-full border border-gray-400 bg-white p-2 text-xs text-gray-900 focus:border-[#0A2540] outline-none font-semibold" 
                                required 
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1">Department *</label>
                              <input 
                                type="text" 
                                value={editedUserData.department || ''} 
                                onChange={e => setEditedUserData({ ...editedUserData, department: e.target.value })} 
                                className="w-full border border-gray-400 bg-white p-2 text-xs text-gray-900 focus:border-[#0A2540] outline-none" 
                                required 
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1">Joining Date</label>
                              <input 
                                type="date" 
                                value={editedUserData.joiningDate || ''} 
                                onChange={e => setEditedUserData({ ...editedUserData, joiningDate: e.target.value })} 
                                className="w-full border border-gray-400 bg-white p-2 text-xs text-gray-900 focus:border-[#0A2540] outline-none font-mono" 
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1">Employee Status *</label>
                              <select 
                                value={editedUserData.employeeStatus || 'Permanent'} 
                                onChange={e => setEditedUserData({ ...editedUserData, employeeStatus: e.target.value })} 
                                className="w-full border border-gray-400 bg-white p-2 text-xs text-gray-900 focus:border-[#0A2540] outline-none"
                                required
                              >
                                {EMPLOYEE_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-[11px] font-black uppercase tracking-wider text-[#0A2540] border-b border-gray-300 pb-1 mb-3 font-sans">
                            5. Bank Account Details / बैंक खाता विवरण
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-gray-50 p-4 border border-gray-300">
                            <div>
                              <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">Bank Account Number</label>
                              <input 
                                type="text" 
                                value={editedUserData.bankAccountNo || ''} 
                                onChange={e => setEditedUserData({ ...editedUserData, bankAccountNo: e.target.value })} 
                                className="w-full border border-gray-400 bg-white p-2 text-xs font-mono" 
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">Bank Name</label>
                              <input 
                                type="text" 
                                value={editedUserData.bankName || ''} 
                                onChange={e => setEditedUserData({ ...editedUserData, bankName: e.target.value })} 
                                className="w-full border border-gray-400 bg-white p-2 text-xs" 
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">IFSC Routing Code</label>
                              <input 
                                type="text" 
                                value={editedUserData.ifscCode || ''} 
                                onChange={e => setEditedUserData({ ...editedUserData, ifscCode: e.target.value.toUpperCase() })} 
                                className="w-full border border-gray-400 bg-white p-2 text-xs font-mono" 
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">Bank Branch Location</label>
                              <input 
                                type="text" 
                                value={editedUserData.bankBranch || ''} 
                                onChange={e => setEditedUserData({ ...editedUserData, bankBranch: e.target.value })} 
                                className="w-full border border-gray-400 bg-white p-2 text-xs" 
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-3 justify-end border-t border-gray-200 pt-4">
                          <button 
                            type="button" 
                            onClick={() => setIsEditingUser(false)} 
                            className="px-4 py-2 border border-gray-400 bg-white text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                          >
                            Discard Changes
                          </button>
                          <button 
                            type="submit" 
                            className="px-6 py-2 bg-[#0A2540] text-white text-xs font-black uppercase tracking-wider border border-black hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            Save & Update Master Records
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <SectionCard title={`Name of Record File: ${selectedUser.fullName}`} color="indigo">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                          <div>
                            <InfoRow label="Employee ID" value={selectedUser.username} />
                            <InfoRow label="Full Name" value={selectedUser.fullName} />
                            <InfoRow label="Gender" value={selectedUser.gender} />
                            <InfoRow label="Date of Birth" value={selectedUser.dob} />
                            <InfoRow label="Nationality" value={selectedUser.nationality} />
                          </div>
                          <div>
                            <InfoRow label="Designation" value={selectedUser.designation} />
                            <InfoRow label="Department" value={selectedUser.department} />
                            <InfoRow label="Employment Category" value={selectedUser.employeeStatus} />
                            <InfoRow label="Official Joining Date" value={selectedUser.joiningDate} />
                            <InfoRow label="Total Tickets Filed" value={ticketCountFor(selectedUser.username)} />
                          </div>
                        </div>
                      </SectionCard>

                      <SectionCard title="Contact & Official Identification Details" color="slate">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                          <div>
                            <InfoRow label="Postal Address" value={selectedUser.address} />
                            <InfoRow label="Phone Number" value={selectedUser.phone} />
                            <InfoRow label="Email Address" value={selectedUser.email} />
                            <InfoRow label="Emergency Line" value={selectedUser.emergencyContact} />
                          </div>
                          <div>
                            <InfoRow label="Aadhaar Reference" value={selectedUser.aadhar} />
                            <InfoRow label="Passport Ref" value={selectedUser.passport} />
                            <InfoRow label="Income Tax PAN" value={selectedUser.pan} />
                            <InfoRow label="Other GOVT ID" value={selectedUser.otherGovtId} />
                          </div>
                        </div>
                      </SectionCard>

                      <SectionCard title="Bank Account Details" color="amber">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                          <div>
                            <InfoRow label="Bank Account Number" value={selectedUser.bankAccountNo} />
                            <InfoRow label="Bank Name" value={selectedUser.bankName} />
                          </div>
                          <div>
                            <InfoRow label="IFSC Code " value={selectedUser.ifscCode} />
                            <InfoRow label="Branch" value={selectedUser.bankBranch} />
                          </div>
                        </div>
                      </SectionCard>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white border border-gray-300 shadow-sm overflow-hidden">
                  <div className="bg-[#0A2540] text-white px-4 py-2.5 text-xs font-bold tracking-wider uppercase font-sans flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <span>Employees Master Database</span>
                    
                    <div className="w-full sm:w-72 relative text-gray-900">
                      <input
                        type="text"
                        placeholder="Search by Name or ID..."
                        value={searchUserQuery}
                        onChange={(e) => setSearchUserQuery(e.target.value)}
                        className="w-full bg-white/10 border border-white/20 text-white placeholder-gray-400 text-xs px-3 py-1 outline-none focus:bg-white focus:text-gray-900 focus:placeholder-gray-500 transition-all font-sans"
                      />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-100 border-b border-gray-300 text-gray-700 uppercase tracking-wider font-mono text-[10px]">
                          <th className="p-3 font-bold">Employee ID</th>
                          <th className="p-3 font-bold">Full Name</th>
                          <th className="p-3 font-bold">Department</th>
                          <th className="p-3 font-bold">Designation</th>
                          <th className="p-3 font-bold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {filteredEmployees.length > 0 ? (
                          filteredEmployees.map((user) => (
                            <tr key={user.id} className="hover:bg-amber-50/50 transition-colors">
                              <td className="p-3 font-mono font-bold text-[#0A2540]">{user.username}</td>
                              <td className="p-3 font-semibold uppercase">{user.fullName}</td>
                              <td className="p-3 text-gray-600">{user.department || '—'}</td>
                              <td className="p-3 text-gray-600 font-medium">{user.designation || '—'}</td>
                              <td className="p-3 text-right">
                                <button 
                                  onClick={() => setSelectedUser(user)} 
                                  className="bg-[#0A2540] text-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider border border-black hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                  Open File 📂
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="5" className="p-8 text-center text-gray-500 font-mono italic">
                              No matching employee records found for "{searchUserQuery}".
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── ADMIN: ACTION REQUEST TICKETS AMENDMENT TAB ── */}
          {adminTab === 'requests' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-3">
                <div className="bg-white border border-gray-300 shadow-sm overflow-hidden">
                  <div className="bg-gray-800 text-white px-4 py-2.5 text-xs font-bold uppercase tracking-wide">
                    Ticket Requests
                  </div>
                  <div className="divide-y divide-gray-200">
                    {allAmendments.length > 0 ? (
                      allAmendments.map(amend => (
                        <div
                          key={amend.id}
                          onClick={() => { 
                            setSelectedAmendment(amend); 
                            setResolveNotes(amend.resolveNotes || ''); 
                            setAdminSelectedStatus(amend.status || 'Pending');
                          }}
                          className={`p-4 transition-colors cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 ${selectedAmendment?.id === amend.id ? 'bg-amber-50' : 'bg-white hover:bg-gray-50'}`}
                        >
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-xs font-black text-gray-900">{amend.ticketNo}</span>
                              <Badge status={amend.status} />
                            </div>
                            <p className="text-xs text-gray-700 font-medium">
                              From: <span className="uppercase font-bold text-[#0A2540]">{amend.employeeName}</span> ({amend.employeeId})
                            </p>
                            <p className="text-[11px] text-gray-500 mt-1 font-sans">
                              Category of Ticket: <span className="font-bold uppercase text-slate-700">{amend.category}</span>
                            </p>
                          </div>
                          <span className="text-[10px] font-mono text-gray-400">
                            {amend.submittedAt ? new Date(amend.submittedAt.seconds * 1000).toLocaleDateString() : 'Recent'}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-gray-500 italic text-xs font-mono">
                        Clear Line: No active Tickets pending response verification.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* SIDE RESOLUTION PANEL CONSOLE */}
              <div className="bg-white border border-gray-300 shadow-sm p-4 h-fit sticky top-20">
                <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest border-b pb-2 mb-3">Details of Ticket</h3>
                {selectedAmendment ? (
                  <div className="space-y-4">
                    <div className="bg-gray-50 border border-gray-200 p-3">
                      <span className="block text-[9px] font-mono font-bold text-gray-400 uppercase">Modification Details</span>
                      <p className="text-xs text-gray-800 font-mono leading-relaxed whitespace-pre-wrap">{selectedAmendment.details}</p>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">Set Ticket Status</label>
                        <select 
                          value={adminSelectedStatus}
                          onChange={(e) => setAdminSelectedStatus(e.target.value)}
                          className="w-full border border-gray-400 p-2 text-xs font-bold outline-none bg-white focus:border-[#0A2540]"
                        >
                          <option value="Pending">🕒 Pending</option>
                          <option value="In Progress">⚙️ In Progress</option>
                          <option value="Resolved">✅ Resolved</option>
                          <option value="Rejected">❌ Rejected</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">Administrative Action / Modification Notes</label>
                        <textarea
                          rows={4}
                          value={resolveNotes}
                          onChange={e => setResolveNotes(e.target.value)}
                          placeholder="Provide concrete details of adjustments performed or refusal reasoning..."
                          className="w-full border border-gray-400 p-2 text-xs font-mono text-gray-900 focus:border-slate-700 outline-none bg-white"
                        />
                      </div>

                      <button
                        onClick={() => handleUpdateTicketStatus(selectedAmendment)}
                        disabled={resolveLoading}
                        className="w-full bg-[#0A2540] text-white py-2 text-xs font-black uppercase tracking-wider border border-black hover:bg-slate-800 transition-colors disabled:opacity-40 cursor-pointer"
                      >
                        {resolveLoading ? 'Updating...' : 'Update Status & Notify Employee'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic font-mono text-center py-6">Select a ticket and Modify Request .</p>
                )}
              </div>
            </div>
          )}
        </main>

        <footer className="bg-white border-t border-gray-300 py-4 text-center text-gray-500 mt-12">
          <p className="text-[10px] font-bold tracking-wide">{PORTAL_CONFIG.footerText}</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F6F9] font-sans text-gray-900">
      <div className="w-full flex h-1.5"><div className="flex-1 bg-[#FF9933]" /><div className="flex-1 bg-white" /><div className="flex-1 bg-[#138808]" /></div>

      <header className="bg-[#0A2540] text-white px-6 py-4 shadow-sm border-b border-gray-800">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img src={PORTAL_CONFIG.logoUrl} alt="VPA Logo" className="h-12 w-12 rounded-full object-contain bg-white p-1 border border-gray-200 shadow-sm " />
            <div>
              <h1 className="text-md font-black tracking-wide">{PORTAL_CONFIG.organizationName}</h1>
              <p className="text-[10px] font-bold text-[#B38F00] uppercase tracking-widest">{PORTAL_CONFIG.portalTypeLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-left sm:text-right">
              <span className="block text-xs font-black uppercase tracking-wide">{userData.fullName}</span>
              <span className="block text-[10px] font-mono text-gray-400">ID: {userData.username}</span>
            </div>
            <button
              onClick={handleSignOut}
              className="border border-red-700 bg-red-800 px-3 py-1 text-xs font-bold text-white hover:bg-red-900 transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-gray-300 shadow-sm sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-6 flex gap-0">
          {[
            { key: 'profile', label: '👤 Details' },
            { key: 'raise', label: '✍ Modification Ticket Request' },
            { key: 'status', label: '🔍 Track My Ticket' },
          ].map(page => (
            <button
              key={page.key}
              onClick={() => setUserPage(page.key)}
              className={`px-5 py-3.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${userPage === page.key ? 'border-b-2 border-b-[#0A2540] text-[#0A2540] bg-gray-50' : 'border-b-transparent text-gray-500 hover:text-gray-900'}`}
            >
              {page.label}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 py-6">

        {userPage === 'profile' && (
          <div className="space-y-4">
            <SectionCard title="1. Profile Structure / मुख्य विवरण" color="blue">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <div>
                  <InfoRow label="Full Legal Name" value={userData.fullName} />
                  <InfoRow label="Gender Specification" value={userData.gender} />
                  <InfoRow label="Validated Date of Birth" value={userData.dob} />
                </div>
                <div>
                  <InfoRow label="Nationality" value={userData.nationality} />
                  <InfoRow label="Role" value={userData.role} />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="2. Correspondence & Communications " color="slate">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <div>
                  <InfoRow label="Permanent Address" value={userData.address} />
                  <InfoRow label="Validated Phone Number" value={userData.phone} />
                </div>
                <div>
                  <InfoRow label="Official Email" value={userData.email} />
                  <InfoRow label="Emergency Contact " value={userData.emergencyContact} />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="3. Government Identification Details" color="indigo">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <div>
                  <InfoRow label="Aadhaar Reference" value={userData.aadhar} />
                  <InfoRow label="Passport id" value={userData.passport} />
                </div>
                <div>
                  <InfoRow label="Income Tax PAN ID" value={userData.pan} />
                  <InfoRow label="Other Id" value={userData.otherGovtId} />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="4. Employee Details" color="amber">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <div>
                  <InfoRow label="Designation" value={userData.designation} />
                  <InfoRow label="Department " value={userData.department} />
                </div>
                <div>
                  <InfoRow label="Employee Type" value={userData.employeeStatus} />
                  <InfoRow label="Official Joining Date" value={userData.joiningDate} />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="5. Bank Account Details" color="green">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <div>
                  <InfoRow label=" Bank Account No" value={userData.bankAccountNo} />
                  <InfoRow label="Bank Name" value={userData.bankName} />
                </div>
                <div>
                  <InfoRow label="IFSC code" value={userData.ifscCode} />
                  <InfoRow label="Branch" value={userData.bankBranch} />
                </div>
              </div>
            </SectionCard>
          </div>
        )}

        {userPage === 'raise' && (
          <div className="max-w-xl mx-auto bg-white border border-gray-300 shadow-sm">
            <div className="bg-gray-100 border-b border-gray-300 px-4 py-2.5">
              <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">Request Upadation Form</h3>
            </div>
            <form onSubmit={handleRequestSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase text-gray-700 mb-1">Category of Modification</label>
                <select
                  value={reqCategory}
                  onChange={e => setReqCategory(e.target.value)}
                  className="w-full border border-gray-400 bg-white px-3 py-2 text-xs text-gray-900 outline-none focus:border-[#0A2540]"
                >
                  {REQUEST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-gray-700 mb-1">Request of Modification</label>
                <textarea
                  rows={5}
                  value={reqDetails}
                  onChange={e => setReqDetails(e.target.value)}
                  placeholder="Provide explicit clarification regarding the required database field variables configuration mutations..."
                  className="w-full border border-gray-400 p-2 text-xs font-mono text-gray-900 outline-none focus:border-[#0A2540]"
                  required
                />
              </div>

              {ticketResult && (
                <div className="border border-emerald-400 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-950 font-medium">
                  🎉 <strong className="font-black text-emerald-900">Your Modification request sent sucessfully</strong>
                  <div className="mt-1 font-mono text-[11px]">System Reference Tracking Ticket ID: <span className="underline font-black">{ticketResult}</span></div>
                  <p className="text-[10px] text-emerald-800 mt-1">An authorization mail has been sent to your registered Email account.</p>
                </div>
              )}

              <button
                type="submit"
                disabled={reqLoading || !reqDetails.trim()}
                className="w-full bg-[#0A2540] text-white py-2 text-xs font-black uppercase tracking-widest border border-black hover:bg-slate-800 transition-colors disabled:opacity-40 cursor-pointer"
              >
                {reqLoading ? 'Submitting...' : 'SUBMIT AND GET TICKET'}
              </button>
            </form>
          </div>
        )}

        {userPage === 'status' && (
          <div className="max-w-xl mx-auto space-y-4">
            <div className="bg-white border border-gray-300 shadow-sm p-4">
              <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider mb-3">Track Your Ticket</h3>
              <form onSubmit={handleStatusCheck} className="flex gap-2">
                <input
                  type="text"
                  placeholder="VPA-TKT-MQXXXXX-KXGA"
                  value={statusQuery}
                  onChange={e => setStatusQuery(e.target.value)}
                  className="flex-1 border border-gray-400 bg-white px-3 py-2 text-xs font-mono uppercase text-gray-900 outline-none focus:border-[#0A2540]"
                  required
                />
                <button
                  type="submit"
                  disabled={statusLoading}
                  className="bg-[#0A2540] text-white px-4 py-2 text-xs font-bold uppercase border border-black hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  TRACK
                </button>
              </form>
            </div>

            {statusLoading && <div className="text-xs font-mono text-gray-500 animate-pulse text-center">Interrogating remote database tracking indexes...</div>}
            {statusError && <div className="border border-red-400 bg-red-50 text-red-900 text-xs font-bold p-3 font-mono">{statusError}</div>}

            {statusResult && (
              <div className="bg-white border border-gray-300 shadow-sm overflow-hidden">
                <div className="bg-gray-800 text-white px-4 py-2 text-xs font-bold flex justify-between items-center font-mono">
                  <span>Ticket: {statusResult.ticketNo}</span>
                  <Badge status={statusResult.status} />
                </div>
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-2 border-b border-gray-100 pb-2 text-[11px]">
                    <p><strong className="text-gray-500 uppercase font-sans text-[10px]">Updation Category:</strong> {statusResult.category}</p>
                    <p className="text-right text-gray-400 font-mono">
                      Logged: {statusResult.submittedAt ? new Date(statusResult.submittedAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">Your Instructed Update Request</p>
                    <p className="text-xs text-gray-800 bg-gray-50 border border-gray-200 p-2.5 font-mono">{statusResult.details}</p>
                  </div>
                  
                  <div className="border border-gray-300 bg-gray-50 p-3">
                    <p className="text-[10px] font-black uppercase text-gray-600 mb-0.5">Official Administrative Status Update</p>
                    <div className="mt-1">
                      <Badge status={statusResult.status} />
                    </div>
                    {statusResult.resolveNotes && (
                      <p className="text-xs text-gray-700 mt-2 font-mono bg-white p-2 border border-gray-200">
                        <strong>Official Remarks:</strong> {statusResult.resolveNotes}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-gray-300 py-4 text-center text-gray-500 mt-12">
        <p className="text-[10px] font-bold tracking-wide">{PORTAL_CONFIG.footerText}</p>
      </footer>
    </div>
  );
}