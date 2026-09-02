const cron = require('node-cron');
const NegotiationSession = require('../models/NegotiationSession');

const startCleanupJob = () => {
  // Runs every 30 minutes to clean abandoned / zombie sessions older than 2 hours
  cron.schedule('*/30 * * * *', async () => {
    try {
      const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago

      const result = await NegotiationSession.updateMany(
        {
          status: 'ongoing',
          updatedAt: { $lt: cutoff }
        },
        {
          $set: {
            status: 'no_deal',
            closed_at: new Date()
          }
        }
      );

      if (result.modifiedCount > 0) {
        console.log(`[Cron] Closed ${result.modifiedCount} abandoned ongoing sessions.`);
      }
    } catch (err) {
      console.error('[Cron] Session cleanup job error:', err.message);
    }
  });

  console.log('[Cron] Parlay session cleanup job scheduled.');
};

module.exports = startCleanupJob;