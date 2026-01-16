import React from 'react';

export const metadata = {
  title: 'Computer-Based Test (CBT)',
  description: 'Take and manage computer-based tests',
};

export default function CBTLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {children}
    </div>
  );
}
