import type {Entry} from './ledger';

export const TRANSACTION_TYPE_FILTERS=[
 ['expense','Expenses'],
 ['income','Income'],
 ['transfer','Transfers'],
 ['reimbursement','Refunds & reimbursements'],
 ['repayment','Repayments'],
 ['lending','Lending'],
 ['groupPayment','Group payments'],
 ['adjustment','Adjustments'],
 ['settlement','Settlements'],
 ['other','Other'],
] as const;

export type TransactionTypeFilter=typeof TRANSACTION_TYPE_FILTERS[number][0];

const filters:Readonly<Partial<Record<string,TransactionTypeFilter>>>={
 expense:'expense',shared:'expense',personExpense:'expense',splitwiseShare:'expense',weeklyShare:'expense',
 income:'income',transfer:'transfer',adjustment:'adjustment',
 refund:'reimbursement',Refund:'reimbursement',merchantRefund:'reimbursement',officeRecovery:'reimbursement',
 repaymentIn:'repayment',repaymentOut:'repayment',groupReceipt:'groupPayment',
 lend:'lending',borrow:'lending',groupPayment:'groupPayment',
 Expense:'expense',Income:'income','Loan Returned':'repayment','Borrowing Repaid':'repayment',Lent:'lending',Borrowed:'lending',
 Saving:'transfer','Savings Withdrawal':'transfer','Cash Withdrawal':'transfer','Cash Deposit':'transfer','Internal Transfer':'transfer',
 'Adjustment Add':'adjustment','Adjustment Subtract':'adjustment',
 'Settlement In':'settlement','Settlement Out':'settlement',
};

export function transactionTypeFilter(entry:Pick<Entry,'kind'|'legacyType'>):TransactionTypeFilter{
 const key=entry.kind==='legacy'?entry.legacyType??'':entry.kind;
 return Object.hasOwn(filters,key)?filters[key]??'other':'other';
}

export function filterTransactionTypes<T extends Pick<Entry,'kind'|'legacyType'>>(entries:T[],selected:readonly TransactionTypeFilter[]){
 const counts:Record<TransactionTypeFilter,number>={
  expense:0,income:0,transfer:0,reimbursement:0,repayment:0,lending:0,groupPayment:0,adjustment:0,settlement:0,other:0,
 };
 const filtered=entries.filter(entry=>{
  const type=transactionTypeFilter(entry);
  counts[type]++;
  return !selected.length||selected.includes(type);
 });
 return {counts,filtered};
}
