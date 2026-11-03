export type TxType = 'Pemasukan' | 'Pengeluaran' | 'Transfer'
export type Alive = 'Aktif' | 'Dihapus'
export interface Account { id: string; name: string; openingBalance: number; status: Alive; createdAt: string; updatedAt: string }
export interface Category { id: string; name: string; kind: 'Pemasukan' | 'Pengeluaran'; status: Alive; createdAt: string; updatedAt: string }
export interface Item { name: string; qty: number; unit: string; price: number }
export interface Tx {
  id: string; date: string; time: string; type: TxType
  accountId: string; accountName: string; toAccountId: string; toAccountName: string
  categoryId: string; categoryName: string
  amount: number; note: string; attachment: string; items: Item[]
  status: Alive; createdAt: string; updatedAt: string; deletedAt: string
}
export interface Note { id: string; date: string; time: string; title: string; body: string; done: boolean; status: Alive; createdAt: string; updatedAt: string }
export interface Data { accounts: Account[]; categories: Category[]; transactions: Tx[]; notes: Note[] }
export interface Balances { accounts: Record<string, number>; income: number; expense: number; total: number }
export interface Cfg { url: string; key: string }

export type Op =
  | { kind: 'tx.save'; tx: Tx; isNew: boolean }
  | { kind: 'tx.delete'; id: string; at: string }
  | { kind: 'tx.restore'; id: string }
  | { kind: 'tx.purge'; id: string }
  | { kind: 'acc.save'; acc: Account; isNew: boolean }
  | { kind: 'acc.delete'; id: string }
  | { kind: 'cat.save'; cat: Category; isNew: boolean }
  | { kind: 'cat.delete'; id: string }
  | { kind: 'note.save'; note: Note; isNew: boolean }
  | { kind: 'note.delete'; id: string }

export interface Queued { opId: string; op: Op; at: string; failed?: boolean; error?: string }
export type Result = { ok: boolean; queued?: boolean; error?: string }
