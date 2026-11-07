/**
 * Biscuit CRM - Dedicated Off-Thread Enterprise Compute Worker
 * Executes heavy GL batch reconciliation, BOM explosions, and multi-entity consolidations
 * without blocking the main React UI thread.
 */

self.onmessage = function (e) {
  const { action, payload, jobId } = e.data;
  const startTime = performance.now();

  if (action === 'BATCH_GL_CONSOLIDATION') {
    const entries = payload.entries || [];
    let debitSum = 0;
    let creditSum = 0;
    const accountBalances = {};

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const debit = Number(entry.debit || 0);
      const credit = Number(entry.credit || 0);
      debitSum += debit;
      creditSum += credit;

      if (entry.debitAccount) {
        accountBalances[entry.debitAccount] = (accountBalances[entry.debitAccount] || 0) + debit;
      }
      if (entry.creditAccount) {
        accountBalances[entry.creditAccount] = (accountBalances[entry.creditAccount] || 0) - credit;
      }
    }

    const durationMs = (performance.now() - startTime).toFixed(2);
    self.postMessage({
      jobId,
      status: 'COMPLETED',
      result: {
        processedCount: entries.length,
        totalDebits: debitSum,
        totalCredits: creditSum,
        variance: Math.abs(debitSum - creditSum),
        durationMs,
        accountBalances
      }
    });
  } else if (action === 'BOM_MULTI_LEVEL_EXPLOSION') {
    const { bomRecipes, stockLevels, targetQty } = payload;
    const shortageList = [];

    (bomRecipes || []).forEach(recipe => {
      const needed = (recipe.quantityPerUnit || 1) * targetQty;
      const onHand = stockLevels[recipe.componentSku] || 0;
      if (onHand < needed) {
        shortageList.push({
          componentSku: recipe.componentSku,
          required: needed,
          available: onHand,
          shortage: needed - onHand
        });
      }
    });

    const durationMs = (performance.now() - startTime).toFixed(2);
    self.postMessage({
      jobId,
      status: 'COMPLETED',
      result: {
        shortageCount: shortageList.length,
        shortageList,
        durationMs
      }
    });
  } else {
    self.postMessage({ jobId, status: 'UNKNOWN_ACTION' });
  }
};
