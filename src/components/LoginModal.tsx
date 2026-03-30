import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Smartphone, MessageSquare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { auth } from '../firebase';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

declare global {
  interface Window {
    recaptchaVerifier: RecaptchaVerifier;
    confirmationResult: ConfirmationResult;
    grecaptcha: any;
  }
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && !window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });
    }
  }, [isOpen]);

  const handleSendCode = async () => {
    if (!phoneNumber || phoneNumber.length < 11) {
      setError('请输入有效的手机号码');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Format phone number for China (+86)
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+86${phoneNumber}`;
      const appVerifier = window.recaptchaVerifier;
      
      const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      window.confirmationResult = confirmationResult;
      
      setStep('code');
    } catch (err: any) {
      console.error(err);
      setError(err.message || '发送验证码失败，请重试');
      // Reset recaptcha on error
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.render().then(widgetId => {
          window.grecaptcha.reset(widgetId);
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length < 6) {
      setError('请输入6位验证码');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await window.confirmationResult.confirm(verificationCode);
      onClose(); // Close modal on success
    } catch (err: any) {
      console.error(err);
      setError('验证码错误或已过期');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError('Google 登录失败');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative"
        >
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>

          <div className="p-6 pt-8">
            <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">欢迎登录</h2>
            <p className="text-center text-slate-500 mb-6 text-sm">
              登录以保存收藏夹、查看干饭周报、发起多人投票
            </p>

            <div id="recaptcha-container"></div>

            {error && (
              <div className="bg-red-50 text-red-500 p-3 rounded-lg text-sm mb-4 text-center">
                {error}
              </div>
            )}

            {step === 'phone' ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">手机号码</label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-slate-300 bg-slate-50 text-slate-500 sm:text-sm">
                      +86
                    </span>
                    <Input
                      type="tel"
                      placeholder="请输入手机号"
                      className="rounded-l-none"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      maxLength={11}
                    />
                  </div>
                </div>
                <Button 
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white" 
                  onClick={handleSendCode}
                  disabled={loading || phoneNumber.length < 11}
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Smartphone className="w-4 h-4 mr-2" />}
                  获取验证码
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">验证码</label>
                  <Input
                    type="text"
                    placeholder="请输入6位验证码"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    maxLength={6}
                    className="text-center tracking-widest text-lg"
                  />
                </div>
                <Button 
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white" 
                  onClick={handleVerifyCode}
                  disabled={loading || verificationCode.length < 6}
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  登录
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full text-slate-500 text-sm"
                  onClick={() => setStep('phone')}
                >
                  返回修改手机号
                </Button>
              </div>
            )}

            <div className="mt-8 relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-500">其他登录方式</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button variant="outline" className="w-full" onClick={handleGoogleLogin}>
                Google 登录
              </Button>
              <Button variant="outline" className="w-full" onClick={() => {
                alert('微信/QQ 登录需要企业资质、域名备案以及开放平台认证，当前环境暂不支持。请使用手机号登录。');
              }}>
                <MessageSquare className="w-4 h-4 mr-2 text-green-500" />
                微信/QQ
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
