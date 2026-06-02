import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  User, 
  LogIn, 
  AlertCircle, 
  Building2, 
  Eye, 
  EyeOff, 
  Sparkles, 
  ShieldCheck
} from 'lucide-react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

interface LoginViewProps {
  lang: 'tr' | 'en';
  onAuthSuccess?: () => void;
}

export default function LoginView({ lang, onAuthSuccess }: LoginViewProps) {
  const isEn = lang === 'en';
  
  // Custom auth states
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Google Authentication Handler
  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      
      // Check if user profile already exists in Firestore
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userDocRef);
      
      if (!userSnap.exists()) {
        // Create new Profile record for Google user
        await setDoc(userDocRef, {
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || 'Usta Kullanıcı',
          email: firebaseUser.email || '',
          role: isEn ? 'Renovation Lead' : 'Tadilat Sorumlusu',
          company: isEn ? 'Freelance Site' : 'Serbest / Bireysel Şantiye',
          avatarUrl: firebaseUser.photoURL || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=120',
          expenseCategories: [
            'Kaba İnşaat',
            'Tesisat & Altyapı',
            'Usta İşçilik & Hizmet',
            'Taşıma & Nakliye & Moloz',
            'Aydınlatma & Aksesuar',
            'Mobilya & Dolap Kapakları',
            'Ruhsat & Belediye & Harç',
            'Diğer Giderler'
          ],
          incomeCategories: [
            'Bütçe Aktarımı',
            'Banka Kredisi',
            'Ortak Sermaye',
            'Yedek Akçe',
            'Müşteri Hak Edişi',
            'Diğer Gelirler'
          ],
          settings: {
            lang: lang,
            currency: 'TRY',
            theme: 'light',
            timezone: 'Europe/Istanbul',
            defaultVatRate: 20,
            budgetWarningThreshold: 90,
            autoSyncMaterialToLedger: true,
            decimalPlaces: 0,
            showWelcomeBanner: true
          }
        });
      }
      
      if (onAuthSuccess) onAuthSuccess();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(isEn ? 'Google Sign-In failed: ' + err.message : 'Google ile giriş başarısız: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Custom Email Sign In / Sign Up handler
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMsg(isEn ? 'Email and Password are required.' : 'E-posta ve şifre girilmesi zorunludur.');
      return;
    }
    if (isSignUp && !username.trim()) {
      setErrorMsg(isEn ? 'Name details must be filled for signing up.' : 'Kayıt için ad soyad girilmesi zorunludur.');
      return;
    }
    
    setLoading(true);
    setErrorMsg(null);
    try {
      if (isSignUp) {
        // 1. Create firebase user credentials
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const uid = cred.user.uid;
        
        // 2. Write document to Firestore User profiles
        await setDoc(doc(db, 'users', uid), {
          uid: uid,
          name: username.trim(),
          email: email.trim(),
          role: role.trim() || (isEn ? 'Site Supervisor' : 'Şantiye Şefi'),
          company: company.trim() || (isEn ? 'Independent Contractor' : 'Müteahhit / Bireysel Ustalar'),
          avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=120',
          expenseCategories: [
            'Kaba İnşaat',
            'Tesisat & Altyapı',
            'Usta İşçilik & Hizmet',
            'Taşıma & Nakliye & Moloz',
            'Aydınlatma & Aksesuar',
            'Mobilya & Dolap Kapakları',
            'Ruhsat & Belediye & Harç',
            'Diğer Giderler'
          ],
          incomeCategories: [
            'Bütçe Aktarımı',
            'Banka Kredisi',
            'Ortak Sermaye',
            'Yedek Akçe',
            'Müşteri Hak Edişi',
            'Diğer Gelirler'
          ],
          settings: {
            lang: lang,
            currency: 'TRY',
            theme: 'light',
            timezone: 'Europe/Istanbul',
            defaultVatRate: 20,
            budgetWarningThreshold: 90,
            autoSyncMaterialToLedger: true,
            decimalPlaces: 0,
            showWelcomeBanner: true
          }
        });
      } else {
        // Sign In Existing user
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      
      if (onAuthSuccess) onAuthSuccess();
    } catch (err: any) {
      console.error(err);
      let turkishError = err.message;
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        turkishError = 'E-posta veya şifre hatalı. Lütfen tekrar deneyin.';
      } else if (err.code === 'auth/email-already-in-use') {
        turkishError = 'Bu e-posta adresi zaten kullanımda.';
      } else if (err.code === 'auth/weak-password') {
        turkishError = 'Şifreniz çok zayıf. En az 6 karakter girin.';
      }
      setErrorMsg(isEn ? err.message : turkishError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-[#0b0f19] transition-colors duration-200">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xl rounded-3xl p-6 md:p-8 space-y-6">
        
        {/* Portal Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-500 text-slate-950 rounded-2xl shadow-lg shadow-amber-500/15 text-2xl">
            🔨
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {isEn ? 'Ustam Renovation Hub' : 'Ustam Şantiye Paneli'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {isEn ? 'Secure Production Access' : 'Bulut veritabanı destekli güvenli canlı şantiye paneli.'}
          </p>
        </div>

        {errorMsg && (
          <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-700 dark:text-rose-450 p-3 rounded-xl flex items-center gap-2 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-4 space-y-2 text-slate-500 dark:text-slate-400">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-xs font-medium">
              {isEn ? 'Connecting securely to the cloud...' : 'Bulut sunucusuna güvenli bağlantı kuruluyor...'}
            </div>
          </div>
        )}

        {/* Custom Login Form */}
        {!loading && (
          <div className="space-y-4 animate-fadeIn">
            
            {/* Google Identity Sign-In */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-2.5 py-3 bg-white dark:bg-slate-800 dark:hover:bg-slate-755 hover:bg-slate-50 active:scale-[0.99] text-slate-700 dark:text-white border border-slate-200 dark:border-slate-700 font-semibold text-xs sm:text-sm rounded-xl cursor-pointer shadow-sm transition-all"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.41 0-6.182-2.77-6.182-6.182 0-3.41 2.771-6.182 6.182-6.182 1.554 0 2.924.582 3.972 1.537l3.075-3.075C19.123 2.146 15.932 1 12.24 1 6.033 1 1 6.033 1 12.24s5.033 11.24 11.24 11.24c5.899 0 10.9-4.237 10.9-11.24 0-.649-.079-1.21-.194-1.955H12.24z"
                />
              </svg>
              {isEn ? 'Continue with Google' : 'Google Hesabı ile Giriş Yap'}
            </button>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
              <span className="flex-shrink mx-4 text-[10px] text-slate-450 font-bold uppercase tracking-widest">{isEn ? 'or' : 'veya'}</span>
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
            </div>

            {/* Email Form */}
            <form onSubmit={handleEmailAuth} className="space-y-4">
              {isSignUp && (
                <>
                  <div className="space-y-1.5 animate-fadeIn">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-450 uppercase">
                      {isEn ? 'Your Full Name *' : 'Ad Soyadınız *'}
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 pointer-events-none">
                        <User className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        required
                        placeholder="Özgür Avlamis"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full text-sm pl-10 pr-3.5 py-2.5 bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 animate-fadeIn">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-450 uppercase">
                        {isEn ? 'Role / Title' : 'Mesleki Rol'}
                      </label>
                      <input
                        type="text"
                        placeholder={isEn ? 'Contractor' : 'Tadilat Şefi'}
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full text-sm px-3.5 py-2.5 bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500 dark:text-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-450 uppercase">
                        {isEn ? 'Company' : 'Şirket Adı'}
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                          <Building2 className="w-3.5 h-3.5 animate-pulse" />
                        </span>
                        <input
                          type="text"
                          placeholder="Avlamis Yapı"
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                          className="w-full text-sm pl-8.5 pr-3 py-2.5 bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-450 uppercase">
                  {isEn ? 'Email Address *' : 'E-Posta Adresiniz *'}
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500 font-mono dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-450 uppercase">
                  {isEn ? 'Password' : 'Giriş Şifresi'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full text-sm px-3.5 py-2.5 bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-slate-950 font-bold text-sm rounded-xl cursor-pointer shadow-lg shadow-amber-500/20 transition-all border border-amber-400/25"
              >
                <LogIn className="w-4 h-4" />
                {isSignUp 
                  ? (isEn ? 'Create Cloud Account & Sign In' : 'Üye Ol ve Giriş Yap') 
                  : (isEn ? 'Sign In with Email' : 'Giriş Yap')
                }
              </button>
              
              <div className="text-center mt-3 text-xs">
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-amber-500 hover:text-amber-600 hover:underline font-bold focus:outline-none"
                >
                  {isSignUp 
                    ? (isEn ? 'Already have an account? Sign In' : 'Zaten hesabınız var mı? Giriş Yapın') 
                    : (isEn ? 'Don\'t have an account yet? Register' : 'Henüz hesabınız yok mu? Kaydolun')
                  }
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-semibold border-t border-slate-100 dark:border-slate-800 pt-4">
          <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
          <span>{isEn ? 'Firestore Secure Cloud' : 'Bulut Veritabanı Korumalı'}</span>
        </div>

      </div>
    </div>
  );
}
