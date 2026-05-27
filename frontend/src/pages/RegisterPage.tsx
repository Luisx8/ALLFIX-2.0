import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, User, Phone, MapPin, Building2, Wrench, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { registerUser } from '../services/firebaseService';
import { Button } from '../components/shared/Button';
import { ROUTES } from '../routes/paths';
import { VENDOR_SERVICES } from '../constants/services';
import { WORK_TYPES_MAPPING } from '../constants/servicesData';
import LampButton from '../components/shared/LampButton';

interface FormData {
  firstName: string; lastName: string; username: string; email: string; password: string; confirmPassword: string;
  phone: string; role: 'customer' | 'vendor';
  // Address
  city: string; cityCode: string;
  barangay: string; barangayCode: string; unitHouseNo: string; street: string; postalCode: string;
  // Vendor
  companyName: string; contactPerson: string;
  termsAccepted: boolean;
}

interface SelectedService {
  service: string;
  sub_services: string[];
  work_types: Array<{
    name: string;
    subService: string;
    price: string;
    status: string;
  }>;
}

const initialFormData: FormData = {
  firstName: '', lastName: '', username: '', email: '', password: '', confirmPassword: '',
  phone: '', role: 'customer',
  city: '', cityCode: '',
  barangay: '', barangayCode: '', unitHouseNo: '', street: '', postalCode: '',
  companyName: '', contactPerson: '',
  termsAccepted: false,
};

const LOCATION_API = import.meta.env.VITE_LOCATION_API || 'https://psgc.gitlab.io/api';
const steps = ['Basic Info', 'Address', 'Contact & Role'];

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefillData = location.state?.prefillData;

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>({
    ...initialFormData,
    firstName: prefillData?.firstName || '',
    lastName: prefillData?.lastName || '',
    username: prefillData?.username || '',
    email: prefillData?.email || '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cities, setCities] = useState<Array<{ code: string; name: string }>>([]);
  const [barangays, setBarangays] = useState<Array<{ code: string; name: string }>>([]);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [usernameCheckLoading, setUsernameCheckLoading] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [usernameValid, setUsernameValid] = useState(false);
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<{ show: boolean, x: number, y: number, text: string }>({ show: false, x: 0, y: 0, text: '' });
  const [servicesCatalog, setServicesCatalog] = useState<any[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  useEffect(() => {
    setLoadingCatalog(true);
    fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api/services`)
      .then((r) => {
        if (!r.ok) throw new Error('API failed');
        return r.json();
      })
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const formatted = data.map((svc: any) => ({
            name: svc.name,
            description: svc.description || '',
            sub: (svc.subServices || []).map((sub: any) => ({
              name: sub.name || sub,
              description: sub.description || '',
              workTypes: sub.workTypes || []
            }))
          }));
          setServicesCatalog(formatted);
        } else {
          throw new Error('Empty database services');
        }
      })
      .catch(() => {
        const fallback = VENDOR_SERVICES.map(svc => ({
          name: svc.name,
          description: svc.description,
          sub: svc.sub.map(s => ({
            name: s.name,
            description: s.description,
            workTypes: WORK_TYPES_MAPPING[s.name] || []
          }))
        }));
        setServicesCatalog(fallback);
      })
      .finally(() => setLoadingCatalog(false));
  }, []);

  const handleMouseMove = (e: React.MouseEvent, text: string) => {
    setActiveTooltip({ show: true, x: e.clientX, y: e.clientY, text });
  };
  const hideTooltip = () => setActiveTooltip({ ...activeTooltip, show: false });

  const toggleService = (serviceName: string) => {
    const exists = selectedServices.find(s => s.service === serviceName);
    if (exists) {
      setSelectedServices(selectedServices.filter(s => s.service !== serviceName));
      setExpandedService(null);
    } else {
      setSelectedServices([...selectedServices, { service: serviceName, sub_services: [], work_types: [] }]);
      setExpandedService(serviceName);
    }
  };

  const toggleSubService = (serviceName: string, subServiceName: string) => {
    setSelectedServices(selectedServices.map(s => {
      if (s.service === serviceName) {
        const hasSub = s.sub_services.includes(subServiceName);
        const newSubs = hasSub
          ? s.sub_services.filter(sub => sub !== subServiceName)
          : [...s.sub_services, subServiceName];

        const currentWts = s.work_types || [];
        const newWts = hasSub
          ? currentWts.filter((wt: any) => wt.subService !== subServiceName)
          : currentWts;

        return {
          ...s,
          sub_services: newSubs,
          work_types: newWts
        };
      }
      return s;
    }));
  };

  const toggleWorkType = (serviceName: string, subServiceName: string, workTypeName: string) => {
    setSelectedServices(selectedServices.map(s => {
      if (s.service === serviceName) {
        const currentWts = s.work_types || [];
        const exists = currentWts.some((wt: any) => wt.name === workTypeName && wt.subService === subServiceName);
        const updatedWts = exists
          ? currentWts.filter((wt: any) => !(wt.name === workTypeName && wt.subService === subServiceName))
          : [...currentWts, { name: workTypeName, subService: subServiceName, price: '0.00', status: 'approved' }];
        return {
          ...s,
          work_types: updatedWts
        };
      }
      return s;
    }));
  };

  const update = (key: keyof FormData, value: string | boolean) => {
    // Strip spaces from specific fields
    let processedValue = value;
    if (typeof value === 'string' && ['username', 'email', 'password', 'confirmPassword', 'phone'].includes(key)) {
      processedValue = value.replace(/\s/g, '');
    }
    // Auto-capitalize first letter for firstName and lastName
    if (typeof value === 'string' && ['firstName', 'lastName'].includes(key) && value.length > 0) {
      processedValue = value.charAt(0).toUpperCase() + value.slice(1);
    }
    setForm((prev) => ({ ...prev, [key]: processedValue }));
    if (key === 'username') {
      setUsernameError('');
      setUsernameValid(false);
    }
  };

  const checkUsername = async (username: string) => {
  if (!username || username.length < 3) {
    setUsernameError('Min 3 chars');
    return;
  }
  setUsernameCheckLoading(true);
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api/auth/check-username?username=${encodeURIComponent(username)}`);
    
    // If endpoint is protected or unavailable, skip the check and let registration handle it
    if (!res.ok) {
      setUsernameValid(true);
      setUsernameError('');
      return;
    }

    const data = await res.json();
    if (data.available) {
      setUsernameValid(true);
      setUsernameError('');
    } else {
      setUsernameError('Username taken');
      setUsernameValid(false);
    }
  } catch {
    // Network error — don't block the user
    setUsernameValid(true);
    setUsernameError('');
  } finally {
    setUsernameCheckLoading(false);
  }
};

  // Check username if prepopulated
  useEffect(() => {
    if (prefillData?.username) {
      checkUsername(prefillData.username);
    }
  }, []);

  // Fetch NCR cities on component mount
  useEffect(() => {
    setCitiesLoading(true);
    fetch(`${LOCATION_API}/regions/130000000/cities-municipalities/`)
      .then((r) => r.json())
      .then((data) => {
        setCities(data.sort((a: any, b: any) => a.name.localeCompare(b.name)));
        setCitiesLoading(false);
      })
      .catch(() => setCitiesLoading(false));
  }, []);

  // Fetch barangays when city changes
  useEffect(() => {
    if (!form.cityCode) { 
      setBarangays([]); 
      return; 
    }
    setBarangays([]);
    update('barangay', ''); 
    update('barangayCode', '');
    fetch(`${LOCATION_API}/cities-municipalities/${form.cityCode}/barangays/`)
      .then((r) => r.json())
      .then((data) => setBarangays(data.sort((a: any, b: any) => a.name.localeCompare(b.name))))
      .catch(() => {});
  }, [form.cityCode]);

  const passwordStrength = useCallback((pw: string) => {
    let s = 0;
    if (pw.length >= 8) s++; if (/[A-Z]/.test(pw)) s++; if (/[0-9]/.test(pw)) s++; if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  }, []);

  const isPhoneValid = (phone: string) => {
    return /^\d{11}$/.test(phone.replace(/\D/g, ''));
  };

  const canNext = () => {
    if (step === 0) return form.firstName && form.lastName && form.username && usernameValid && form.email && form.password && form.password === form.confirmPassword && form.password.length >= 8 && /[A-Z]/.test(form.password) && /[0-9]/.test(form.password) && /[^A-Za-z0-9]/.test(form.password);
    if (step === 1) return form.cityCode && form.barangayCode && form.unitHouseNo && form.street;
    if (step === 2) {
      const hasValidServices = selectedServices.length > 0 && selectedServices.every(s => {
        const serviceDef = servicesCatalog.find(svc => svc.name === s.service);
        if (!serviceDef) return false;
        if (serviceDef.sub.length === 0) return true;
        if (s.sub_services.length === 0) return false;
        
        return s.sub_services.every(subName => {
          const subDef = serviceDef.sub.find((sub: any) => sub.name === subName);
          if (!subDef || !subDef.workTypes || subDef.workTypes.length === 0) return true;
          return (s.work_types || []).some((wt: any) => wt.subService === subName);
        });
      });
      return form.phone && isPhoneValid(form.phone) && form.termsAccepted && (form.role === 'customer' || (form.companyName && hasValidServices));
    }
    return false;
  };

  const handleSubmit = async () => {
    setError(''); setLoading(true);
    try {
      const user = await registerUser(form.email, form.password);
      // Save profile locally; will be written to Firestore after email verification
      const profile: any = {
        uid: user.uid, email: form.email, username: form.username, role: form.role,
        first_name: form.firstName, last_name: form.lastName, phone: form.phone,
        unit_house_no: form.unitHouseNo, street: form.street, barangay: form.barangay,
        city: form.city, region: 'National Capital Region',
        postal_code: form.postalCode,
      };

      if (form.role === 'vendor') {
        profile.company_name = form.companyName;
        profile.services = selectedServices; // Array of {service, sub_services[]}
        profile.contact_person = form.contactPerson || `${form.firstName} ${form.lastName}`;
      }

      localStorage.setItem('pendingRegistration', JSON.stringify({ sentAt: Date.now(), profile }));
      navigate(ROUTES.verifyEmail);
    } catch (err: any) {
      const firebaseCode: string | undefined = err?.code;
      if (firebaseCode === 'auth/email-already-in-use') {
        setError('Email already registered.');
        return;
      }
      if (firebaseCode === 'auth/invalid-email') {
        setError('Invalid email.');
        return;
      }
      if (firebaseCode === 'auth/weak-password') {
        setError('Password too weak.');
        return;
      }
      setError(err.response?.data?.message || err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const strength = passwordStrength(form.password);
  const strengthColors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-brand-green'];
  const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong'];

  return (
    <div className="min-h-screen flex bg-surface-light dark:bg-surface-dark">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-2/5 bg-brand-gradient items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute top-10 left-10 w-72 h-72 bg-brand-green/10 rounded-full blur-3xl" />
        <div className="text-center relative z-10">
          <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-8">
            <Wrench className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Create your account</h2>
          <p className="text-white/70 max-w-sm">Join AllFix.ph as a customer or vendor and start managing property services today.</p>
          {/* Step indicator */}
          <div className="mt-12 flex items-center justify-center gap-4">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${i <= step ? 'bg-brand-green text-white' : 'bg-white/20 text-white/50'}`}>
                  {i < step ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                {i < steps.length - 1 && <div className={`w-12 h-0.5 ${i < step ? 'bg-brand-green' : 'bg-white/20'}`} />}
              </div>
            ))}
          </div>
          <p className="text-white/50 text-sm mt-3">Step {step + 1}: {steps[step]}</p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-lg">
          <div className="flex justify-end mb-4 lg:mb-6">
            <LampButton />
          </div>
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <div className="w-9 h-9 rounded-xl bg-brand-navy flex items-center justify-center"><Wrench className="w-5 h-5 text-white" /></div>
            <span className="text-xl font-bold text-brand-navy dark:text-white">AllFix<span className="text-brand-green">.ph</span></span>
          </div>
          {/* Mobile step indicator */}
          <div className="lg:hidden flex items-center gap-2 mb-6">
            {steps.map((s, i) => (
              <div key={s} className={`flex-1 h-1.5 rounded-full transition-all ${i <= step ? 'bg-brand-navy dark:bg-brand-green' : 'bg-slate-200 dark:bg-slate-700'}`} />
            ))}
          </div>

          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
            {step === 0 ? 'Basic Information' : step === 1 ? 'Your Address' : 'Contact & Role'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Step {step + 1} of {steps.length}</p>

          {error && <div className="mb-4 p-3 rounded-xl bg-brand-red/10 border border-brand-red/20 text-brand-red text-sm">{error}</div>}

          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
              {step === 0 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">First Name</label>
                      <div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input value={form.firstName} onChange={(e) => update('firstName', e.target.value)} className="input-base pl-10" placeholder="Juan" required /></div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Last Name</label>
                      <input value={form.lastName} onChange={(e) => update('lastName', e.target.value)} className="input-base" placeholder="Dela Cruz" required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Username</label>
                    <div className="relative flex gap-2">
                      <input value={form.username} onChange={(e) => update('username', e.target.value)} onBlur={() => form.username && checkUsername(form.username)} className="input-base flex-1" placeholder="username" required />
                      {usernameCheckLoading && <div className="text-xs text-slate-400 flex items-center">Checking...</div>}
                    </div>
                    {usernameError && <p className="text-xs text-brand-red mt-1">{usernameError}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                    <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} className="input-base pl-10" placeholder="you@example.com" required /></div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
                    <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => update('password', e.target.value)} className="input-base pl-10 pr-10" placeholder="Min 8 characters" required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button></div>
                    {form.password && (
                      <div className="mt-2">
                        <div className="flex gap-1">{[0,1,2,3].map(i => <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i < strength ? strengthColors[strength-1] : 'bg-slate-200 dark:bg-slate-700'}`} />)}</div>
                        <p className="text-xs mt-1 text-slate-500">{strengthLabels[strength-1] || 'Too weak'}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Confirm Password</label>
                    <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="password" value={form.confirmPassword} onChange={(e) => update('confirmPassword', e.target.value)} className="input-base pl-10" placeholder="Re-enter password" required /></div>
                    {form.confirmPassword && form.password !== form.confirmPassword && <p className="text-xs text-brand-red mt-1">Passwords don't match</p>}
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-400 mb-2"><MapPin className="w-3 h-3 inline mr-1" />Region: National Capital Region (NCR) — auto-filled</p>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">City / Municipality</label>
                    <select value={form.cityCode} onChange={(e) => { const c = cities.find(x => x.code === e.target.value); update('cityCode', e.target.value); update('city', c?.name || ''); }} className="input-base" disabled={citiesLoading}>
                      <option value="">{citiesLoading ? 'Loading...' : 'Select city...'}</option>
                      {cities.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Barangay</label>
                    <select value={form.barangayCode} onChange={(e) => { const b = barangays.find(x => x.code === e.target.value); update('barangayCode', e.target.value); update('barangay', b?.name || ''); }} className="input-base" disabled={!form.cityCode}>
                      <option value="">Select barangay...</option>
                      {barangays.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Unit / House No.</label>
                      <input value={form.unitHouseNo} onChange={(e) => update('unitHouseNo', e.target.value)} className="input-base" placeholder="e.g. Unit 5B" required /></div>
                    <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Street</label>
                      <input value={form.street} onChange={(e) => update('street', e.target.value)} className="input-base" placeholder="e.g. Rizal Ave" required /></div>
                  </div>
                  <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Postal Code</label>
                    <input value={form.postalCode} onChange={(e) => update('postalCode', e.target.value)} className="input-base" placeholder="e.g. 1000" /></div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                    <div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input value={form.phone} onChange={(e) => update('phone', e.target.value)} className="input-base pl-10" placeholder="09XX XXX XXXX" required /></div>
                    {form.phone && !isPhoneValid(form.phone) && <p className="text-xs text-brand-red mt-1">Phone must be exactly 11 digits</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">I am a...</label>
                    <div className="grid grid-cols-2 gap-3">
                      {(['customer', 'vendor'] as const).map(r => (
                        <button key={r} type="button" onClick={() => update('role', r)}
                          className={`p-4 rounded-xl border-2 transition-all text-left ${form.role === r ? 'border-brand-navy dark:border-brand-green bg-brand-navy/5 dark:bg-brand-green/10' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
                          <div className="flex items-center gap-3">
                            {r === 'customer' ? <User className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                            <div><p className="font-semibold text-sm capitalize text-slate-900 dark:text-white">{r}</p>
                              <p className="text-xs text-slate-500">{r === 'customer' ? 'I need services' : 'I provide services'}</p></div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  {form.role === 'vendor' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4 overflow-hidden">
                      <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Company Name</label>
                        <div className="relative"><Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input value={form.companyName} onChange={(e) => update('companyName', e.target.value)} className="input-base pl-10" placeholder="Your company name" /></div>
                      </div>
                      <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Services You Offer</label>
                        <div className="max-h-96 overflow-y-scroll pr-2" style={{ overflowY: 'scroll', WebkitOverflowScrolling: 'touch' }}>
                          <div className="space-y-2 overflow-visible">
                          {loadingCatalog ? (
                            <div className="space-y-2">
                              {Array(3).fill(0).map((_, i) => (
                                <div key={i} className="animate-pulse h-12 bg-slate-100 dark:bg-slate-800 rounded-lg" />
                              ))}
                            </div>
                          ) : (
                            servicesCatalog.map(service => {
                              const isSelected = selectedServices.find(s => s.service === service.name);
                              return (
                                <div key={service.name} className="space-y-2 relative z-10">
                                  <button
                                    type="button"
                                    onClick={() => toggleService(service.name)}
                                    className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                                      isSelected
                                        ? 'border-brand-navy dark:border-brand-green bg-brand-navy/5 dark:bg-brand-green/10'
                                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex-1">
                                        <p 
                                          className="font-semibold text-sm text-slate-900 dark:text-white relative cursor-help inline-block"
                                          onMouseMove={(e) => handleMouseMove(e, service.description)}
                                          onMouseLeave={hideTooltip}
                                        >
                                          {service.name}
                                        </p>
                                      </div>
                                      {isSelected && <Check className="w-4 h-4 text-brand-navy dark:text-brand-green flex-shrink-0 mt-1" />}
                                    </div>
                                  </button>

                                  {isSelected && service.sub.length > 0 && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="ml-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3 overflow-visible relative z-0">
                                      <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">Sub-services & Work Types:</p>
                                      <div className="space-y-3">
                                        {service.sub.map((sub: any) => {
                                          const isSubSelected = isSelected?.sub_services.includes(sub.name) || false;
                                          const subWorkTypes = sub.workTypes || [];

                                          return (
                                            <div key={sub.name} className="space-y-1.5 border-l-2 border-slate-200 dark:border-slate-700 pl-3">
                                              <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                  type="checkbox"
                                                  checked={isSubSelected}
                                                  onChange={() => toggleSubService(service.name, sub.name)}
                                                  className="w-3.5 h-3.5 rounded border-slate-300 text-brand-navy focus:ring-brand-navy"
                                                />
                                                <div className="flex-1 min-h-fit">
                                                  <span 
                                                    className="text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-help inline-block"
                                                    onMouseMove={(e) => handleMouseMove(e, sub.description)}
                                                    onMouseLeave={hideTooltip}
                                                  >
                                                    {sub.name}
                                                  </span>
                                                </div>
                                              </label>

                                              {isSubSelected && subWorkTypes.length > 0 && (
                                                <div className="ml-5 mt-1 space-y-1">
                                                  <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Select Work Types:</p>
                                                  {subWorkTypes.map((wt: string) => {
                                                    const isWtSelected = isSelected.work_types?.some((vwt: any) => vwt.name === wt && vwt.subService === sub.name);

                                                    return (
                                                      <label key={wt} className="flex items-center gap-2 cursor-pointer py-0.5">
                                                        <input
                                                          type="checkbox"
                                                          checked={!!isWtSelected}
                                                          onChange={() => toggleWorkType(service.name, sub.name, wt)}
                                                          className="w-3 h-3 rounded border-slate-300 text-brand-green focus:ring-brand-green"
                                                        />
                                                        <span className="text-[11px] text-slate-600 dark:text-slate-450">{wt}</span>
                                                      </label>
                                                    );
                                                  })}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </motion.div>
                                  )}
                                </div>
                              );
                            })
                          )}
                          </div>
                        </div>
                        {selectedServices.length > 0 && (
                          <div className="mt-3 p-2 rounded-lg bg-brand-green/10 border border-brand-green/20">
                            <p className="text-xs font-medium text-brand-green">Selected: {selectedServices.map(s => `${s.service} (${s.sub_services.length})`).join(', ')}</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                  <label className="flex items-start gap-3 cursor-pointer mt-4">
                    <input type="checkbox" checked={form.termsAccepted} onChange={(e) => update('termsAccepted', e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-slate-300 text-brand-navy focus:ring-brand-navy" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">I agree to the <a href="#" className="text-brand-navy dark:text-brand-green font-medium hover:underline">Terms & Conditions</a> and <a href="#" className="text-brand-navy dark:text-brand-green font-medium hover:underline">Privacy Policy</a>.</span>
                  </label>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            {step > 0 ? (
              <Button variant="ghost" onClick={() => setStep(s => s - 1)} icon={<ChevronLeft className="w-4 h-4" />}>Back</Button>
            ) : <div />}
            {step < 2 ? (
              <Button onClick={() => setStep(s => s + 1)} disabled={!canNext()} icon={<ChevronRight className="w-4 h-4" />}>Continue</Button>
            ) : (
              <Button onClick={handleSubmit} loading={loading} disabled={!canNext()} variant="success">Create Account</Button>
            )}
          </div>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Already have an account? <Link to={ROUTES.login} className="text-brand-navy dark:text-brand-green font-semibold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>

      {/* Global dynamically positioned tooltip */}
      {activeTooltip.show && (
        <div 
          className="fixed bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs rounded p-2 w-56 max-w-xs break-words shadow-xl z-[9999] pointer-events-none"
          style={{
            left: activeTooltip.x + 15 + 224 > window.innerWidth ? activeTooltip.x - 240 : activeTooltip.x + 15,
            top: activeTooltip.y + 15 + 80 > window.innerHeight ? activeTooltip.y - 80 : activeTooltip.y + 15
          }}
        >
          {activeTooltip.text}
        </div>
      )}
    </div>
  );
}
