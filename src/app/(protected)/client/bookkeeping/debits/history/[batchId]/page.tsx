import ClientBookkeepingDebitBatchDetailSection from '@/components/client/bookkeeping/debits/ClientBookkeepingDebitBatchDetailSection'

type Props = {
  params: Promise<{ batchId: string }>
}

export default async function ClientBookkeepingDebitsHistoryDetailPage({ params }: Props) {
  const { batchId } = await params
  const parsedBatchId = Number(batchId)

  if (!Number.isInteger(parsedBatchId) || parsedBatchId <= 0) {
    return <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">잘못된 배치 ID입니다.</div>
  }

  return <ClientBookkeepingDebitBatchDetailSection batchId={parsedBatchId} />
}
