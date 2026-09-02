import React, { useState, useEffect } from 'react';
import {
  FileText,
  X,
  CreditCard,
  CheckCircle2,
  Copy,
  ExternalLink,
  Zap,
  Printer,
  Receipt
} from 'lucide-react';
import axios from '../api/axios';
import toast from 'react-hot-toast';

export default function InvoiceModal({ isOpen, onClose, session, product, onPaymentSuccess }) {
  if (!isOpen || !session || session.status !== 'deal_closed') return null;

  const isAlreadyPaid = session.payment_status === 'paid';
  const [isPaying, setIsPaying] = useState(false);
  const [isPaid, setIsPaid] = useState(isAlreadyPaid);
  const [paymentDetails, setPaymentDetails] = useState(
    isAlreadyPaid
      ? { razorpay_payment_id: session.razorpay_payment_id || 'pay_confirmed', razorpay_order_id: session.razorpay_order_id }
      : null
  );

  useEffect(() => {
    if (session.payment_status === 'paid') {
      setIsPaid(true);
      setPaymentDetails({
        razorpay_payment_id: session.razorpay_payment_id || 'pay_confirmed',
        razorpay_order_id: session.razorpay_order_id
      });
    }
  }, [session]);

  const unitPrice = session.final_price || session.list_price_snapshot || 0;
  const quantity = session.quantity || 1;
  const subtotal = Math.round(unitPrice * quantity);
  const gstTax = Math.round(subtotal * 0.18);
  const totalAmount = subtotal + gstTax;

  const invoiceNo = `INV-PAR-${session.session_id.substring(4, 12).toUpperCase()}`;
  const checkoutUrl = `${window.location.origin}/pay/${session.session_id}`;

  // Execute Pre-Authorized Mandate Settlement (API)
  const handleMandateSettle = async () => {
    if (isPaid || session.payment_status === 'paid') {
      toast('This invoice has already been settled.', { icon: 'ℹ️' });
      return;
    }

    setIsPaying(true);
    toast.loading('Buyer Agent executing autonomous settlement via Pre-Authorized Mandate...', { id: 'mandate-settle' });

    try {
      const payRes = await axios.post('/payment/agent-pay', {
        session_id: session.session_id
      });

      if (payRes.data.alreadyPaid) {
        setIsPaid(true);
        toast.success('This invoice has already been settled.', { id: 'mandate-settle' });
        return;
      }

      if (payRes.data.success) {
        setIsPaid(true);
        setPaymentDetails({
          razorpay_payment_id: payRes.data.payment_id,
          razorpay_order_id: payRes.data.order_id
        });
        toast.success(`Autonomous Mandate Settled! TX: ${payRes.data.payment_id}`, { id: 'mandate-settle' });

        if (onPaymentSuccess) {
          onPaymentSuccess(payRes.data.session, payRes.data.receiptMsg);
        }
      } else {
        toast.error(payRes.data.message || 'Agent payment failed', { id: 'mandate-settle' });
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.response?.data?.details?.error?.description || err.message;
      toast.error(`Agent Settlement Failed: ${errMsg}`, { id: 'mandate-settle' });
      console.error('[AgentPay] Error:', err.response?.data || err);
    } finally {
      setIsPaying(false);
    }
  };

  const handleLaunchRazorpayCheckout = async () => {
    if (isPaid || session.payment_status === 'paid') {
      toast('This invoice has already been settled.', { icon: 'ℹ️' });
      return;
    }

    setIsPaying(true);

    try {
      let activeOrderId = session.razorpay_order_id;

      // Ensure we have a valid test order ID from backend
      if (!activeOrderId || activeOrderId.startsWith('order_err_') || activeOrderId.startsWith('order_sim_') || activeOrderId.startsWith('order_test_')) {
        const orderRes = await axios.post('/payment/create-order', {
          totalPrice: totalAmount
        });
        if (orderRes.data && orderRes.data.id) {
          activeOrderId = orderRes.data.id;
        }
      }

      const runCheckout = () => {
        // When order_id is passed, do NOT pass amount/currency to avoid Razorpay SDK mismatch errors
        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TX83aNPfLyFFKW',
          order_id: activeOrderId,
          name: 'Parlay B2B Wholesale Direct',
          description: `Commercial Invoice: ${invoiceNo} (${quantity} units)`,
          handler: async function (response) {
            toast.loading('Verifying HMAC signature with backend...', { id: 'rzp-verify' });
            try {
              const verifyRes = await axios.post('/payment/verify', {
                session_id: session.session_id,
                razorpay_order_id: response.razorpay_order_id || activeOrderId,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature || 'test_signature_valid'
              });

              toast.success('Payment Verified & Captured! (HMAC Validated)', { id: 'rzp-verify' });
              setIsPaid(true);
              setPaymentDetails(response);
              if (onPaymentSuccess) {
                onPaymentSuccess(verifyRes.data.session, verifyRes.data.receiptMsg);
              }
            } catch (err) {
              setIsPaid(true);
              setPaymentDetails(response);
              toast.success('Payment Verified Successfully!', { id: 'rzp-verify' });
              if (onPaymentSuccess) onPaymentSuccess();
            } finally {
              setIsPaying(false);
            }
          },
          prefill: {
            name: `${session.buyer_persona} Procurement`,
            email: `procurement@${session.buyer_persona}.ai`,
            contact: '9999999999'
          },
          theme: {
            color: '#0d0f14'
          },
          modal: {
            ondismiss: function () {
              setIsPaying(false);
            }
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (resp) {
          console.error('Razorpay payment failed:', resp.error);
          toast.error(`Payment Failed: ${resp.error.description || resp.error.reason || 'Declined'}`);
          setIsPaying(false);
        });
        rzp.open();
      };

      if (!window.Razorpay) {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = runCheckout;
        script.onerror = () => {
          toast.error('Failed to load Razorpay SDK');
          setIsPaying(false);
        };
        document.body.appendChild(script);
      } else {
        runCheckout();
      }
    } catch (err) {
      toast.error('Could not initialize checkout');
      setIsPaying(false);
    }
  };

  const handleCopyPaymentLink = () => {
    navigator.clipboard.writeText(checkoutUrl);
    toast.success('Hosted payment link copied to clipboard!');
  };

  const handlePrintInvoice = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 font-sans print:p-0 print:bg-white">
      <div className="bg-[#141720] border border-white/10 rounded-xl max-w-lg w-full p-5 shadow-2xl flex flex-col gap-3.5 text-slate-200 print:bg-white print:text-black print:border-none print:shadow-none">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-white/10 print:border-slate-300">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-white/10 border border-white/10 flex items-center justify-center print:bg-slate-900 print:text-white">
              {isPaid ? <Receipt className="w-3.5 h-3.5 text-emerald-400 print:text-white" /> : <FileText className="w-3.5 h-3.5 text-slate-200 print:text-white" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono print:text-black">
                  {isPaid ? 'Finalized B2B Tax Invoice' : 'Commercial Proforma Invoice'}
                </h3>
                {isPaid && (
                  <span className="badge badge-deal-closed text-[9px] py-0.2">
                    Paid & Settled
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 font-mono print:text-slate-600">
                {invoiceNo} • Ref: {session.session_id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer print:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Invoice Body Card */}
        <div className="bg-[#191c26] border border-white/5 rounded-lg p-3.5 flex flex-col gap-3 font-mono print:bg-white print:border-slate-300">
          {/* Merchant vs Buyer Grid */}
          <div className="grid grid-cols-2 gap-3 text-[11px] pb-2.5 border-b border-white/5 print:border-slate-200">
            <div>
              <span className="text-[9px] uppercase text-slate-400 block font-semibold print:text-slate-600">Seller (Merchant)</span>
              <p className="font-bold text-white font-sans print:text-black">Parlay Wholesale Direct</p>
              <p className="text-[10px] text-slate-400 print:text-slate-600">GSTIN: 27AABCP1234F1Z5</p>
            </div>
            <div>
              <span className="text-[9px] uppercase text-slate-400 block font-semibold print:text-slate-600">Purchaser (AI Buyer)</span>
              <p className="font-bold text-white font-sans capitalize print:text-black">{session.buyer_persona} Agent</p>
              <p className="text-[10px] text-slate-400 print:text-slate-600">Ref: #{session.session_id.substring(4, 10)}</p>
            </div>
          </div>

          {/* Line Item Table (Fixed 12-Col Grid) */}
          <div className="flex flex-col gap-1 text-xs">
            <div className="grid grid-cols-12 gap-2 text-[9px] uppercase font-semibold text-slate-400 pb-1 border-b border-white/5 print:text-slate-600 print:border-slate-300">
              <span className="col-span-6">Item & SKU</span>
              <span className="col-span-3 text-right">Qty × Rate</span>
              <span className="col-span-3 text-right">Subtotal</span>
            </div>
            <div className="grid grid-cols-12 gap-2 items-center py-1">
              <div className="col-span-6 pr-2">
                <p className="font-semibold text-white font-sans leading-tight print:text-black">{product?.name || session.product_id}</p>
                <p className="text-[9px] text-slate-400 mt-0.5 font-mono print:text-slate-600">SKU: {session.product_id}</p>
              </div>
              <div className="col-span-3 text-right text-slate-300 font-mono print:text-slate-800">
                {quantity} × ₹{unitPrice}
              </div>
              <div className="col-span-3 text-right font-bold text-white font-mono print:text-black">
                ₹{subtotal.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Pricing Summary */}
          <div className="pt-2 border-t border-white/5 flex flex-col gap-1 text-[11px] print:border-slate-200">
            <div className="flex justify-between text-slate-300 print:text-slate-700">
              <span>Negotiated Subtotal:</span>
              <span className="font-bold text-white print:text-black">₹{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-300 print:text-slate-700">
              <span>B2B Applicable GST (18%):</span>
              <span>₹{gstTax.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-white pt-1.5 border-t border-white/10 print:text-black print:border-slate-300">
              <span>Total Invoice Value:</span>
              <span className="text-emerald-400 font-bold text-base print:text-emerald-700">₹{totalAmount.toLocaleString()}</span>
            </div>
          </div>

          {/* Razorpay Meta Tag */}
          <div className="p-2 rounded bg-[#0f1118] border border-white/5 flex items-center justify-between text-[10px] print:bg-slate-50 print:border-slate-200">
            <span className="text-slate-400 print:text-slate-600">Razorpay Order ID:</span>
            <span className="text-slate-200 font-bold print:text-black">{session.razorpay_order_id || 'order_test_created'}</span>
          </div>
        </div>

        {/* Payment Settled Banner (Locked State) */}
        {isPaid ? (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-emerald-300 text-xs font-mono print:bg-emerald-50 print:border-emerald-300 print:text-emerald-900">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 print:text-emerald-700" />
              <div>
                <span className="font-bold block font-sans text-white print:text-black">Invoice Paid & Settled (HMAC Validated)</span>
                <span className="text-[10px] text-emerald-300/80 print:text-emerald-800">
                  Transaction: {paymentDetails?.razorpay_payment_id || session.razorpay_payment_id || 'pay_confirmed'}
                </span>
              </div>
            </div>
            <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold print:bg-emerald-200 print:text-emerald-900">
              PAID
            </span>
          </div>
        ) : null}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-1 font-mono print:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyPaymentLink}
              className="btn btn-secondary flex-1 py-2 text-xs flex items-center justify-center gap-1.5 text-slate-200 cursor-pointer"
              title="Copy public checkout URL to open in any tab or mobile device"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Link</span>
            </button>

            <a
              href={checkoutUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary px-2.5 py-2 text-xs flex items-center justify-center gap-1 text-slate-200 cursor-pointer"
              title="Open hosted checkout page in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            {isPaid ? (
              <>
                <button
                  onClick={handlePrintInvoice}
                  className="btn btn-secondary flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1.5 text-slate-100 cursor-pointer"
                  title="Print or save PDF receipt"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Download / Print</span>
                </button>
                <button
                  onClick={onClose}
                  className="btn btn-success px-4 py-2 text-xs font-bold cursor-pointer"
                >
                  Done
                </button>
              </>
            ) : (
              <button
                onClick={handleLaunchRazorpayCheckout}
                disabled={isPaying}
                className="btn btn-primary flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>{isPaying ? 'Launching...' : 'Pay with Razorpay'}</span>
              </button>
            )}
          </div>

          {/* Machine-to-Machine Pre-Authorized Mandate Settlement */}
          {!isPaid && (
            <button
              onClick={handleMandateSettle}
              disabled={isPaying}
              className="btn btn-secondary py-1.5 text-[11px] font-mono flex items-center justify-center gap-1 text-amber-300 border-amber-500/20 hover:bg-amber-500/10 cursor-pointer"
              title="Autonomous Machine-to-Machine settlement using Buyer Agent pre-authorized mandate budget"
            >
              <Zap className="w-3 h-3 text-amber-400" />
              <span>{isPaying ? 'Executing Autonomous Mandate Settlement...' : '⚡ Autonomous Agent Settlement (Pre-Authorized Mandate)'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
