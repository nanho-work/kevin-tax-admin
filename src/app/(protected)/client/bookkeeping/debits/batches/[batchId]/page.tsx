import ClientBookkeepingDebitBatchDetailSection from '@/components/client/bookkeeping/debits/ClientBookkeepingDebitBatchDetailSection'

interface Props {
  params: Promise<{ batchId: string }>
}

export default async function ClientBookkeepingDebitsBatchDetailPage({ params }: Props) {
  const { batchId } = await params
  const parsedBatchId = Number(batchId)

  if (!Number.isFinite(parsedBatchId) || parsedBatchId <= 0) {
    return (
      <section className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-10 text-center text-sm text-rose-700">
        잘못된 배치 ID 입니다.
      </section>
    )
  }

  return <ClientBookkeepingDebitBatchDetailSection batchId={parsedBatchId} />
}
