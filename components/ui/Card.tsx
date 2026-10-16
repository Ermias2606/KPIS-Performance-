
import React, { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <div className={`bg-white/95 backdrop-blur-md shadow-xs hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 rounded-2xl border border-slate-200/80 p-6 ${className}`}>
      {children}
    </div>
  );
};

export default Card;
