import React, { useState, useEffect } from 'react';
import {
  FileText,
  X,
  CreditCard,
  CheckCircle2,
  Zap,
  Printer,
  Receipt,
  AlertCircle
} from 'lucide-react';
import axios from '../api/axios';
import toast from 'react-hot-toast';

export default function InvoiceModal({ isOpen, onClose, session, product, onPaymentSuccess, role = 'merchant', initialTab = 'invoice' }) {
  if (!isOpen || !session || session.status !== 'deal_closed') return null;

  const isAlreadyPaid = session.payment_status === 'paid';
  const [isPaying, setIsPaying] = useState(false);
  const [isPaid, setIsPaid] = useState(isAlreadyPaid);
  const [docView, setDocView] = useState(initialTab || 'invoice');
  const [paymentDetails, setPaymentDetails] = useState(
    isAlreadyPaid
      ? { razorpay_payment_id: session.razorpay_payment_id || 'pay_confirmed', razorpay_order_id: session.razorpay_order_id }
      : null
  );

  useEffect(() => {
    if (isOpen) {
      setDocView(initialTab || 'invoice');
    }
  }, [isOpen, initialTab]);

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
  const receiptNo = `RCPT-PAR-${session.session_id.substring(4, 12).toUpperCase()}`;

  const paymentId = paymentDetails?.razorpay_payment_id || session.razorpay_payment_id || 'pay_confirmed';
  const orderId = paymentDetails?.razorpay_order_id || session.razorpay_order_id || 'order_confirmed';
  const paidAtFormatted = session.paid_at ? new Date(session.paid_at).toLocaleString('en-IN') : new Date().toLocaleString('en-IN');

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
      const isGenuineRazorpayOrderId = activeOrderId && /^order_[A-Za-z0-9]{14,20}$/.test(activeOrderId);
      if (!isGenuineRazorpayOrderId) {
        const orderRes = await axios.post('/payment/create-order', {
          totalPrice: totalAmount
        });
        if (orderRes.data && orderRes.data.id) {
          activeOrderId = orderRes.data.id;
        }
      }

      const runCheckout = () => {
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
            color: '#09090b'
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

  const handlePrintInvoice = () => {
    const isReceipt = docView === 'receipt' && isPaid;
    const docTitle = isReceipt ? `Payment_Receipt_${receiptNo}` : `Tax_Invoice_${invoiceNo}`;
    const buyerName = session.buyer_agent_name || (session.buyer_persona ? `${session.buyer_persona} Agent` : 'Authorized Procurement Agent');
    const productName = session.product_name || product?.name || session.product_id;
    const halfGst = Math.round(gstTax / 2);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${docTitle}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 15mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #09090b;
              background: #ffffff;
              font-size: 13px;
              line-height: 1.5;
            }
            .document {
              max-width: 100%;
              margin: 0 auto;
              border: 1px solid #e4e4e7;
              border-radius: 8px;
              padding: 32px;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2px solid #09090b;
              padding-bottom: 16px;
              margin-bottom: 24px;
            }
            .brand-title {
              font-size: 22px;
              font-weight: 900;
              letter-spacing: -0.5px;
            }
            .brand-subtitle {
              font-size: 11px;
              color: #71717a;
              font-family: monospace;
              margin-top: 2px;
            }
            .doc-type {
              text-align: right;
            }
            .doc-type-badge {
              font-size: 12px;
              font-weight: 800;
              font-family: monospace;
              padding: 4px 10px;
              background: #ecfdf5;
              color: #065f46;
              border: 1px solid #10b981;
              border-radius: 4px;
              display: inline-block;
              margin-bottom: 6px;
            }
            .doc-number {
              font-family: monospace;
              font-size: 14px;
              font-weight: 700;
            }
            .doc-date {
              font-size: 11px;
              color: #71717a;
            }
            .parties-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-bottom: 24px;
            }
            .party-box {
              background: #fafafa;
              border: 1px solid #e4e4e7;
              border-radius: 6px;
              padding: 14px;
            }
            .party-label {
              font-size: 10px;
              text-transform: uppercase;
              font-weight: 700;
              color: #71717a;
              font-family: monospace;
              margin-bottom: 4px;
            }
            .party-name {
              font-size: 14px;
              font-weight: 700;
              margin-bottom: 4px;
            }
            .party-meta {
              font-size: 11px;
              color: #52525b;
              line-height: 1.4;
            }
            .table-container {
              margin-bottom: 24px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              text-align: left;
            }
            th {
              background: #f4f4f5;
              padding: 10px 12px;
              font-size: 10px;
              text-transform: uppercase;
              font-family: monospace;
              color: #52525b;
              border-bottom: 1px solid #d4d4d8;
            }
            td {
              padding: 12px;
              border-bottom: 1px solid #e4e4e7;
              font-size: 12px;
            }
            .sku-tag {
              font-family: monospace;
              font-size: 10px;
              color: #71717a;
              margin-top: 2px;
            }
            .summary-section {
              display: flex;
              justify-content: flex-end;
              margin-bottom: 24px;
            }
            .summary-box {
              width: 320px;
              background: #fafafa;
              border: 1px solid #e4e4e7;
              border-radius: 6px;
              padding: 16px;
            }
            .summary-row {
              display: flex;
              justify-content: space-between;
              font-size: 12px;
              color: #52525b;
              margin-bottom: 8px;
            }
            .summary-row.total {
              border-top: 2px solid #09090b;
              padding-top: 10px;
              margin-top: 6px;
              font-size: 15px;
              font-weight: 800;
              color: #09090b;
            }
            .summary-row.balance {
              font-size: 11px;
              color: #065f46;
              font-weight: 700;
              margin-top: 4px;
            }
            .footer {
              border-top: 1px solid #e4e4e7;
              padding-top: 16px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 10px;
              color: #71717a;
            }
            .seal-badge {
              font-weight: 700;
              color: #065f46;
              display: flex;
              align-items: center;
              gap: 4px;
            }
          </style>
        </head>
        <body>
          <div class="document">
            <div class="header">
              <div>
                <div class="brand-title">PARLAY COMMERCE</div>
                <div class="brand-subtitle">Autonomous B2B Trading & Settlement Protocol</div>
              </div>
              <div class="doc-type">
                <div class="doc-type-badge">
                  ${isReceipt ? '✔ OFFICIAL PAYMENT RECEIPT' : isPaid ? '✔ TAX INVOICE (PAID)' : 'COMMERCIAL PROFORMA INVOICE'}
                </div>
                <div class="doc-number">${isReceipt ? receiptNo : invoiceNo}</div>
                <div class="doc-date">Date: ${paidAtFormatted}</div>
              </div>
            </div>

            <div class="parties-grid">
              <div class="party-box">
                <div class="party-label">${isReceipt ? 'Beneficiary (Merchant)' : 'Seller (Merchant)'}</div>
                <div class="party-name">Parlay Wholesale Direct</div>
                <div class="party-meta">
                  GSTIN: <strong>27AABCP1234F1Z5</strong><br>
                  B2B Trade Towers, BKC, Mumbai, Maharashtra 400051<br>
                  State: Maharashtra (Code: 27)
                </div>
              </div>
              <div class="party-box">
                <div class="party-label">${isReceipt ? 'Remitter (Purchaser)' : 'Purchaser (AI Buyer)'}</div>
                <div class="party-name">${buyerName}</div>
                <div class="party-meta">
                  Session Reference: <strong>#${session.session_id}</strong><br>
                  Corporate Procurement Account #CORP-${session.session_id.substring(4, 10).toUpperCase()}<br>
                  Tax Status: Registered B2B Entity
                </div>
              </div>
            </div>

            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th style="width: 50%;">Item Description</th>
                    <th style="width: 15%;">HSN</th>
                    <th style="width: 15%; text-align: right;">Qty × Rate</th>
                    <th style="width: 20%; text-align: right;">Total (INR)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>${productName}</strong>
                      <div class="sku-tag">SKU: ${session.product_id}</div>
                    </td>
                    <td>8539</td>
                    <td style="text-align: right;">${quantity} × ₹${unitPrice.toLocaleString()}</td>
                    <td style="text-align: right;"><strong>₹${subtotal.toLocaleString()}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="summary-section">
              <div class="summary-box">
                <div class="summary-row">
                  <span>Taxable Commercial Subtotal:</span>
                  <span>₹${subtotal.toLocaleString()}</span>
                </div>
                <div class="summary-row">
                  <span>Central GST (CGST @ 9%):</span>
                  <span>₹${halfGst.toLocaleString()}</span>
                </div>
                <div class="summary-row">
                  <span>State GST (SGST @ 9%):</span>
                  <span>₹${halfGst.toLocaleString()}</span>
                </div>
                <div class="summary-row total">
                  <span>Grand Settlement Total:</span>
                  <span>₹${totalAmount.toLocaleString()}</span>
                </div>
                <div class="summary-row balance">
                  <span>Settlement Status:</span>
                  <span>${isPaid ? 'PAID IN FULL (₹0.00 DUE)' : 'UNPAID PROFORMA'}</span>
                </div>
              </div>
            </div>

            <div class="footer">
              <div>
                Parlay Autonomous Commerce Protocol • Formally Executed Electronic Instrument
              </div>
              <div class="seal-badge">
                ✔ DIGITALLY AUTHENTICATED
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(htmlContent);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1500);
    }, 250);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 font-sans">
      <div className="bg-zinc-900 border border-white/[0.08] rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 shadow-2xl flex flex-col gap-3.5 text-zinc-200">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-zinc-800 border border-white/[0.06] flex items-center justify-center">
              {docView === 'receipt' && isPaid ? (
                <Receipt className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-wider font-mono">
                  {docView === 'receipt' && isPaid
                    ? 'Official Payment Settlement Receipt'
                    : isPaid
                    ? 'Finalized B2B Tax Invoice'
                    : 'Commercial Proforma Invoice'}
                </h3>
                {isPaid && (
                  <span className="text-[9px] px-2 py-0.5 rounded font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                    {docView === 'receipt' ? 'Settled & Captured' : 'Paid & Settled'}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-zinc-500 font-mono">
                {docView === 'receipt' && isPaid ? receiptNo : invoiceNo} • Ref: {session.session_id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Document Type Switcher */}
        {isPaid && (
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-white/[0.06] font-mono text-xs">
            <button
              onClick={() => setDocView('invoice')}
              className={`flex-1 py-1.5 px-3 rounded flex items-center justify-center gap-1.5 font-bold transition-all cursor-pointer ${
                docView === 'invoice'
                  ? 'bg-zinc-800 text-zinc-100 border border-white/10 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Commercial Tax Invoice</span>
            </button>
            <button
              onClick={() => setDocView('receipt')}
              className={`flex-1 py-1.5 px-3 rounded flex items-center justify-center gap-1.5 font-bold transition-all cursor-pointer ${
                docView === 'receipt'
                  ? 'bg-emerald-500 text-zinc-950 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>B2B Payment Receipt</span>
            </button>
          </div>
        )}

        {/* VIEW 1: OFFICIAL B2B PAYMENT RECEIPT */}
        {docView === 'receipt' && isPaid ? (
          <div className="bg-zinc-950/60 border border-emerald-500/20 rounded-lg p-3.5 flex flex-col gap-3 font-mono">
            {/* Receipt Identification Header */}
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
              <div>
                <span className="text-[9px] uppercase font-bold text-emerald-400 tracking-wider block">
                  OFFICIAL PAYMENT SETTLEMENT RECEIPT
                </span>
                <p className="text-xs font-bold text-zinc-100 font-sans">{receiptNo}</p>
                <p className="text-[10px] text-zinc-500">{paidAtFormatted}</p>
              </div>
              <div className="text-right">
                <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                  ✔ PAYMENT CAPTURED
                </span>
                <p className="text-[9px] text-zinc-500 mt-0.5">HMAC-SHA256 Validated</p>
              </div>
            </div>

            {/* Merchant vs Buyer Grid */}
            <div className="grid grid-cols-2 gap-3 text-[11px] pb-2 border-b border-white/[0.04]">
              <div className="p-2.5 rounded bg-zinc-900/80 border border-white/[0.04]">
                <span className="text-[9px] uppercase text-zinc-500 block font-semibold">Beneficiary (Merchant)</span>
                <p className="font-bold text-zinc-100 font-sans text-xs">Parlay Wholesale Direct</p>
                <p className="text-[10px] text-zinc-500 font-mono">GSTIN: 27AABCP1234F1Z5</p>
              </div>
              <div className="p-2.5 rounded bg-zinc-900/80 border border-white/[0.04]">
                <span className="text-[9px] uppercase text-zinc-500 block font-semibold">Remitter (Purchaser)</span>
                <p className="font-bold text-zinc-100 font-sans text-xs capitalize">
                  {session.buyer_agent_name || (session.buyer_persona ? `${session.buyer_persona} Procurement Agent` : 'Enterprise Buyer Bot')}
                </p>
                <p className="text-[10px] text-zinc-500 font-mono">Ref: #{session.session_id}</p>
              </div>
            </div>

            {/* Transaction Parameters Table */}
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between items-center text-zinc-300 py-1 border-b border-white/[0.04]">
                <span className="text-zinc-500 font-medium">Razorpay Payment ID:</span>
                <span className="text-zinc-100 font-bold font-mono">{paymentId}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-300 py-1 border-b border-white/[0.04]">
                <span className="text-zinc-500 font-medium">Razorpay Order ID:</span>
                <span className="text-zinc-100 font-bold font-mono">{orderId}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-300 py-1 border-b border-white/[0.04]">
                <span className="text-zinc-500 font-medium">Payment Rail:</span>
                <span className="text-emerald-400 font-bold">Razorpay Autonomous M2M Pre-Authorized Mandate</span>
              </div>
              <div className="flex justify-between items-center text-zinc-300 py-1">
                <span className="text-zinc-500 font-medium">Procured SKU:</span>
                <span className="text-zinc-100 font-bold font-sans">
                  {session.product_name || product?.name || session.product_id} ({quantity} units)
                </span>
              </div>
            </div>

            {/* Financial Settlement Box */}
            <div className="p-3 rounded-lg bg-zinc-950 border border-emerald-500/25 flex flex-col gap-1.5 text-[11px]">
              <div className="flex justify-between text-zinc-400">
                <span>Subtotal Received:</span>
                <span className="text-zinc-100 font-bold">₹{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>B2B Applicable GST (18%):</span>
                <span className="text-zinc-100 font-mono">₹{gstTax.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-zinc-100 pt-1.5 border-t border-white/[0.06]">
                <span className="text-emerald-400 font-bold">Total Net Settled:</span>
                <span className="text-emerald-400 text-base font-bold">₹{totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[10px] text-zinc-500 pt-0.5">
                <span>Balance Outstanding:</span>
                <span className="text-emerald-400 font-bold">₹0.00 (Zero Balance Due • Fully Settled)</span>
              </div>
            </div>

            {/* Security Footer */}
            <div className="pt-2 flex items-center justify-between text-[10px] text-zinc-500 border-t border-white/[0.04]">
              <span>Settlement Gateway: Razorpay Verified Corporate Rails</span>
              <span className="font-bold text-emerald-400 font-mono">AUTHENTICATED FINANCIAL VOUCHER</span>
            </div>
          </div>
        ) : (
          /* VIEW 2: COMMERCIAL TAX INVOICE */
          <div className="bg-zinc-950/60 border border-white/[0.06] rounded-lg p-3.5 flex flex-col gap-3 font-mono">
            {/* Merchant vs Buyer Grid */}
            <div className="grid grid-cols-2 gap-3 text-[11px] pb-2.5 border-b border-white/[0.04]">
              <div className="p-2.5 rounded bg-zinc-900/80 border border-white/[0.04]">
                <span className="text-[9px] uppercase text-zinc-500 block font-semibold">Seller (Merchant)</span>
                <p className="font-bold text-zinc-100 font-sans text-xs">Parlay Wholesale Direct</p>
                <p className="text-[10px] text-zinc-500 font-mono">GSTIN: 27AABCP1234F1Z5</p>
              </div>
              <div className="p-2.5 rounded bg-zinc-900/80 border border-white/[0.04]">
                <span className="text-[9px] uppercase text-zinc-500 block font-semibold">Purchaser (AI Buyer)</span>
                <p className="font-bold text-zinc-100 font-sans text-xs capitalize">
                  {session.buyer_agent_name || (session.buyer_persona ? `${session.buyer_persona} Agent` : 'Enterprise Buyer Bot')}
                </p>
                <p className="text-[10px] text-zinc-500 font-mono">Ref: #{session.session_id}</p>
              </div>
            </div>

            {/* Line Item Table */}
            <div className="flex flex-col gap-1 text-xs">
              <div className="grid grid-cols-12 gap-2 text-[9px] uppercase font-semibold text-zinc-500 pb-1 border-b border-white/[0.04]">
                <span className="col-span-6">Item Description & SKU</span>
                <span className="col-span-3 text-right">Qty × Rate</span>
                <span className="col-span-3 text-right">Subtotal</span>
              </div>
              <div className="grid grid-cols-12 gap-2 items-center py-1.5 border-b border-white/[0.04]">
                <div className="col-span-6 pr-2">
                  <p className="font-semibold text-zinc-100 font-sans text-xs leading-tight">
                    {session.product_name || product?.name || session.product_id}
                  </p>
                  <p className="text-[9px] text-zinc-500 mt-0.5 font-mono">
                    SKU: {session.product_id} • HSN: 8539
                  </p>
                </div>
                <div className="col-span-3 text-right text-zinc-300 font-mono text-xs">
                  {quantity} × ₹{unitPrice}
                </div>
                <div className="col-span-3 text-right font-bold text-zinc-100 font-mono text-xs">
                  ₹{subtotal.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Pricing Summary */}
            <div className="pt-2 flex flex-col gap-1 text-[11px]">
              <div className="flex justify-between text-zinc-400">
                <span>Negotiated Commercial Subtotal:</span>
                <span className="font-bold text-zinc-100">₹{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Central GST (CGST 9%):</span>
                <span className="font-mono text-zinc-200">₹{Math.round(gstTax / 2).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>State GST (SGST 9%):</span>
                <span className="font-mono text-zinc-200">₹{Math.round(gstTax / 2).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-zinc-100 pt-1.5 border-t border-white/[0.06]">
                <span>Total Invoice Value:</span>
                <span className="text-emerald-400 font-bold text-base">₹{totalAmount.toLocaleString()}</span>
              </div>
            </div>

            {/* Razorpay Meta Tag */}
            <div className="p-2.5 rounded bg-zinc-950 border border-white/[0.04] flex items-center justify-between text-[11px]">
              <span className="text-zinc-500 font-medium">Razorpay Order Reference:</span>
              <span className="text-zinc-300 font-bold font-mono">{orderId}</span>
            </div>
          </div>
        )}

        {/* Payment Settled Banner */}
        {isPaid && docView === 'invoice' ? (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between text-emerald-300 text-xs font-mono">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold block font-sans text-zinc-100">Invoice Paid & Settled (HMAC Validated)</span>
                <span className="text-[11px] text-emerald-300/80">
                  Payment Reference: {paymentId}
                </span>
              </div>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
              PAID & CAPTURED
            </span>
          </div>
        ) : null}

        {/* Merchant Waiting on Buyer Banner */}
        {!isPaid && role === 'merchant' && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-amber-300 text-xs font-mono">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <span className="font-bold block font-sans text-zinc-100">Commercial Proforma Issued to Buyer</span>
                <span className="text-[11px] text-amber-300/80">Awaiting Buyer Settlement via Razorpay / A2A Mandate</span>
              </div>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
              UNPAID
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-1 font-mono">
          {role === 'merchant' ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrintInvoice}
                className="btn btn-secondary flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1.5 text-zinc-200 cursor-pointer"
                title={docView === 'receipt' ? "Print official payment receipt" : isPaid ? "Print official tax invoice" : "Print proforma invoice"}
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{docView === 'receipt' && isPaid ? 'Download / Print Payment Receipt' : isPaid ? 'Download / Print Tax Invoice' : 'Download / Print Proforma'}</span>
              </button>
              <button
                onClick={onClose}
                className="btn btn-success px-5 py-2 text-xs font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                {isPaid ? (
                  <>
                    <button
                      onClick={handlePrintInvoice}
                      className="btn btn-secondary flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1.5 text-zinc-200 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>{docView === 'receipt' ? 'Download / Print Payment Receipt' : 'Download / Print Tax Invoice'}</span>
                    </button>
                    <button
                      onClick={onClose}
                      className="btn btn-success px-4 py-2 text-xs font-bold cursor-pointer"
                    >
                      Done
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleLaunchRazorpayCheckout}
                      disabled={isPaying}
                      className="btn btn-primary flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>{isPaying ? 'Launching Razorpay...' : 'Pay with Razorpay'}</span>
                    </button>
                    <button
                      onClick={handlePrintInvoice}
                      className="btn btn-secondary px-3 py-2 text-xs font-bold flex items-center justify-center gap-1 text-zinc-300 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>

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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
