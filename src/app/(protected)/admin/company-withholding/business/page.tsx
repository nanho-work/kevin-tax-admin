import WithholdingNavigation from '@/components/admin/withholding33/WithholdingNavigation'
import Withholding33BusinessSection from '@/components/admin/withholding33/Withholding33BusinessSection'

export default function AdminCompanyWithholdingBusinessPage() {
  return <div className="space-y-4"><WithholdingNavigation active="business" /><Withholding33BusinessSection /></div>
}
