/**
 * Zero-Knowledge Client-Side Bank Statement Parser
 * Parses OFX and standard UK/International Bank CSV exports directly in-memory.
 */

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
}

export function parseBankCSV(csvText: string): ParsedTransaction[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const results: ParsedTransaction[] = [];
  const header = lines[0].toLowerCase();
  
  // Detect column indices based on common bank headers (e.g., Barclays, Lloyds, NatWest, Monzo, Revolut)
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
  const dateIdx = headers.findIndex(h => h.includes('date'));
  const descIdx = headers.findIndex(h => h.includes('description') || h.includes('memo') || h.includes('narrative') || h.includes('payee'));
  const amountIdx = headers.findIndex(h => h.includes('amount') || h.includes('value'));
  const debitIdx = headers.findIndex(h => h.includes('debit') || h.includes('paid out'));
  const creditIdx = headers.findIndex(h => h.includes('credit') || h.includes('paid in'));

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    // Handle quoted commas safely
    const cols = rawLine.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^["']|["']$/g, '').trim());

    const dateVal = cols[dateIdx] || new Date().toISOString().split('T')[0];
    const descVal = cols[descIdx] || 'Unidentified Transaction';

    let amount = 0;
    let type: 'DEBIT' | 'CREDIT' = 'DEBIT';

    if (amountIdx !== -1 && cols[amountIdx]) {
      const parsedNum = parseFloat(cols[amountIdx].replace(/[^0-9.-]/g, ''));
      if (!isNaN(parsedNum)) {
        amount = Math.abs(parsedNum);
        type = parsedNum >= 0 ? 'CREDIT' : 'DEBIT';
      }
    } else {
      const debitVal = debitIdx !== -1 && cols[debitIdx] ? parseFloat(cols[debitIdx].replace(/[^0-9.-]/g, '')) : 0;
      const creditVal = creditIdx !== -1 && cols[creditIdx] ? parseFloat(cols[creditIdx].replace(/[^0-9.-]/g, '')) : 0;

      if (!isNaN(creditVal) && creditVal > 0) {
        amount = creditVal;
        type = 'CREDIT';
      } else if (!isNaN(debitVal) && debitVal > 0) {
        amount = debitVal;
        type = 'DEBIT';
      }
    }

    if (amount > 0) {
      results.push({
        date: dateVal,
        description: descVal,
        amount,
        type,
      });
    }
  }

  return results;
}
