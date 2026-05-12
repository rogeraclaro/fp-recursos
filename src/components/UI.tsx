import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  className = '', 
  icon,
  ...props 
}) => {
  const baseStyles = "font-mono font-bold text-sm px-6 py-3 border-2 border-black transition-all duration-75 flex items-center justify-center gap-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none outline-none focus:ring-2 focus:ring-black focus:ring-offset-2";
  
  const variants = {
    primary: "bg-black text-white shadow-[4px_4px_0px_0px_#888] hover:bg-gray-900",
    secondary: "bg-white text-black shadow-[4px_4px_0px_0px_#000] hover:bg-gray-50",
    danger: "bg-red-600 text-white border-red-600 shadow-[4px_4px_0px_0px_#000] hover:bg-red-700",
    ghost: "bg-transparent border-transparent shadow-none hover:bg-gray-200 text-black px-3"
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {icon}
      {children}
    </button>
  );
};

export const Card: React.FC<{ children: React.ReactNode; className?: string; title?: string }> = ({ children, className = '', title }) => (
  <div className={`bg-white border-2 border-black p-4 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] ${className}`}>
    {title && (
      <div className="border-b-2 border-black pb-2 mb-4 font-bold font-mono text-lg uppercase tracking-wider">
        {title}
      </div>
    )}
    {children}
  </div>
);

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input 
    className="w-full bg-white border-2 border-black p-3 font-mono focus:outline-none focus:bg-yellow-50 placeholder-gray-500 shadow-[2px_2px_0px_0px_#ccc] focus:shadow-[2px_2px_0px_0px_#000] transition-all"
    {...props}
  />
);

export const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => (
  <textarea 
    className="w-full bg-white border-2 border-black p-3 font-mono focus:outline-none focus:bg-yellow-50 placeholder-gray-500 shadow-[2px_2px_0px_0px_#ccc] focus:shadow-[2px_2px_0px_0px_#000] transition-all"
    {...props}
  />
);

export const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block font-bold text-xs uppercase mb-1 tracking-widest">{children}</label>
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
  <div className="relative">
    <select 
      className="w-full appearance-none bg-white border-2 border-black p-3 pr-8 font-mono focus:outline-none focus:bg-yellow-50 shadow-[2px_2px_0px_0px_#ccc] focus:shadow-[2px_2px_0px_0px_#000] transition-all"
      {...props}
    />
    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 4L6 9L11 4" stroke="black" strokeWidth="2"/>
      </svg>
    </div>
  </div>
);

export const Badge: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = "bg-yellow-300" }) => (
  <span className={`${color} border border-black px-2 py-0.5 text-xs font-bold uppercase tracking-wider`}>
    {children}
  </span>
);

export const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  priority?: 'normal' | 'high';
}> = ({ isOpen, onClose, title, children, priority = 'normal' }) => {
  if (!isOpen) return null;
  const zIndex = priority === 'high' ? 'z-[60]' : 'z-50';
  return (
    <div className={`fixed inset-0 ${zIndex} flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm`}>
      <div className="bg-white border-4 border-black w-full max-w-lg shadow-[8px_8px_0px_0px_#000] max-h-[90vh] flex flex-col">
        <div className="flex-shrink-0 flex justify-between items-center p-4 border-b-2 border-black bg-yellow-400">
          <h2 className="font-bold text-xl font-mono uppercase truncate pr-4">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-black hover:text-white transition-colors border border-black">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  );
};