import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<any, any> {
  props: any;
  public state: any = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = "حدث خطأ غير متوقع في التطبيق.";
      
      try {
        const parsed = JSON.parse(this.state.error?.message || "");
        if (parsed.error && parsed.error.includes("Missing or insufficient permissions")) {
          errorMessage = "عذراً، لا تملك الصلاحيات الكافية لإتمام هذه العملية. يرجى التأكد من تسجيل الدخول أو تحديث الصفحة.";
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-4xl mb-6">⚠️</div>
          <h1 className="text-3xl font-black text-slate-900 mb-4">عذراً، حدث خطأ ما</h1>
          <p className="text-slate-500 mb-8 max-w-md mx-auto font-bold leading-relaxed">
            {errorMessage}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-10 py-4 sky-btn rounded-2xl font-black shadow-xl"
          >
            تحديث الصفحة
          </button>
          {process.env.NODE_ENV === 'development' && (
            <pre className="mt-8 p-4 bg-slate-100 rounded-xl text-left text-xs overflow-auto max-w-full">
              {this.state.error?.message}
            </pre>
          )}
        </div>
      );
    }

    return (this.props as any).children;
  }
}

export default ErrorBoundary;
