import React, { Component, ReactNode } from 'react';
import * as Icons from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-tech-card border border-red-900/30 rounded-2xl p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-xl bg-red-950/30 border border-red-800/30 flex items-center justify-center">
            <Icons.AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <div>
            <h3 className="text-md font-black uppercase tracking-wider italic text-tech-text">
              {this.props.fallbackTitle || 'Error en el Panel'}
            </h3>
            <p className="text-xs text-tech-muted mt-1 max-w-md mx-auto">
              Ha ocurrido un error inesperado al cargar este componente.
            </p>
            {this.state.error && (
              <details className="mt-3 text-left max-w-md mx-auto">
                <summary className="text-[10px] text-tech-muted cursor-pointer hover:text-tech-text">
                  Detalles técnicos
                </summary>
                <pre className="mt-2 text-[10px] text-red-400 bg-[#1a1b1e] p-3 rounded-lg overflow-x-auto">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
          <button
            onClick={this.handleRetry}
            className="bg-[#1a1b1e] hover:bg-zinc-800 border border-tech-border text-tech-text px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
          >
            Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
