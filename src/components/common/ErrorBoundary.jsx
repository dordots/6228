
import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error: error };
  }

  componentDidCatch(error, errorInfo) {
    // Diagnostic log
    console.error('ARMORY APP CODE: Application Error Boundary Caught an error. This means the app loaded but then crashed.', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-800">
          <div className="text-center p-8 bg-white shadow-lg rounded-lg border border-red-200">
            <h2 className="text-2xl font-bold text-red-600 mb-4">An Application Error Occurred</h2>
            <p className="text-slate-600 mb-4">Something went wrong while rendering this part of the application. Please try refreshing the page.</p>
            <details className="text-left text-xs text-slate-500 bg-slate-50 p-2 rounded">
              <summary>Error Details</summary>
              <pre className="mt-2 whitespace-pre-wrap">
                {this.state.error ? this.state.error.toString() : "No error details available."}
              </pre>
            </details>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-6 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
