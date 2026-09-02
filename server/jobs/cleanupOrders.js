const cron = require('node-cron');
const NegotiationSession = require('../models/NegotiationSession');

/**
 * Background Cron Job: Parlay Order & Session Lifecycle Maintenance
 * Runs every 30 minutes to:
 * 1. Expire zombie ongoing negotiations abandoned by inactive users (> 2 hours)
 * 2. Expire stale unpaid proforma orders (> 24 hours without settlement)
 */
const startCleanupJob = () => {
  cron.schedule('*/30 * * * *', async () => {
    try {
      // 1. Expire abandoned ongoing negotiations (older than 2 hours)
      const ongoingCutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const ongoingResult = await NegotiationSession.updateMany(
        {
          status: 'ongoing',
          updatedAt: { $lt: ongoingCutoff }
        },
        {
          $set: {
            status: 'no_deal',
            closed_at: new Date()
          }
        }
      );

      if (ongoingResult.modifiedCount > 0) {
        console.log(`[Cron] Expired ${ongoingResult.modifiedCount} abandoned ongoing negotiations (> 2 hrs).`);
      }

      // 2. Expire stale unpaid proforma invoices/deals (> 24 hours without settlement)
      const unpaidCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const unpaidResult = await NegotiationSession.updateMany(
        {
          status: 'deal_closed',
          payment_status: 'pending',
          createdAt: { $lt: unpaidCutoff }
        },
        {
          $set: {
            status: 'no_deal',
            closed_at: new Date()
          }
        }
      );

      if (unpaidResult.modifiedCount > 0) {
        console.log(`[Cron] Expired ${unpaidResult.modifiedCount} stale unpaid orders (> 24 hrs).`);
      }
    } catch (err) {
      console.error('[Cron] Order cleanup job error:', err.message);
    }
  });

  console.log('[Cron] Parlay session & stale unpaid order cleanup job scheduled (runs every 30 mins).');
};

module.exports = startCleanupJob;