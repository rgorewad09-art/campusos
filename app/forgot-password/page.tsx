import { Suspense } from 'react';
import ForgotPasswordView from './ForgotPasswordView';
import { Loader2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F7F7F7] dark:bg-[#0A0A0A]">
          <Loader2 className="animate-spin text-[#171717] dark:text-[#EDEDED]" size={28} />
        </div>
      }
    >
      <ForgotPasswordView />
    </Suspense>
  );
}
