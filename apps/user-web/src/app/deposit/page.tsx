'use client';
import { useState } from 'react';

export default function DepositPage() {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateWallet = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/wallet/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        // In a real application, this user_id would be retrieved from the auth context
        body: JSON.stringify({ user_id: 'test-user-id-123' })
      });
      
      const data = await res.json();
      if (res.ok) {
        setAddress(data.address);
      } else {
        setError(data.error || 'Failed to generate wallet');
      }
    } catch (err) {
      setError('An error occurred while generating the wallet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white p-6">
      <div className="max-w-md w-full bg-gray-900 rounded-xl shadow-2xl p-8 border border-gray-800">
        <h1 className="text-3xl font-bold mb-6 text-center text-blue-500">Deposit Funds</h1>
        
        {address ? (
          <div className="bg-black p-6 rounded-lg border border-gray-800 flex flex-col items-center">
            <p className="text-sm text-gray-400 mb-2">Your BSC Deposit Address:</p>
            <p className="font-mono text-lg break-all text-green-400 mb-4 text-center">{address}</p>
            <div className="p-4 bg-white rounded-lg mb-4">
               {/* Placeholder for QR code */}
               <div className="w-32 h-32 bg-gray-200 flex items-center justify-center text-gray-500 text-sm">QR Code</div>
            </div>
            <p className="mt-2 text-xs text-gray-500 text-center">Only send BNB or BEP-20 tokens to this address.</p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-gray-400 mb-6">You don't have a deposit address yet. Generate one to start receiving funds.</p>
            <button 
              onClick={generateWallet}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200"
            >
              {loading ? 'Generating...' : 'Generate Deposit Address'}
            </button>
          </div>
        )}
        
        {error && (
          <p className="mt-4 text-red-400 text-sm text-center">{error}</p>
        )}
      </div>
    </div>
  );
}
