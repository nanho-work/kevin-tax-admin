import type { TaskExecutionMode } from '@/services/workflowTaskBoard'

type Props = {
  taskName: string
  mode: TaskExecutionMode
  sourceName?: string
  attributionMonth: string
}

export default function TaskWorkGuide({ taskName, mode, sourceName, attributionMonth }: Props) {
  const name = taskName.replace(/\s/g, '')
  const period = attributionMonth || '귀속월'
  const example = name.includes('급여')
    ? { description: '해당 귀속월의 직원별 급여 내역이 담긴 급여대장이나 급여명세서를 올려 주세요.', file: `${period}_급여대장.xlsx 또는 급여명세서.pdf` }
    : name.includes('납부')
      ? { description: '해당 업무의 납부서를 올려 주세요. 납부 확인 업무라면 납부확인증을 올려 주세요.', file: `${period}_납부서.pdf 또는 납부확인증.pdf` }
      : name.includes('원천') || name.includes('신고')
        ? { description: '신고 업무에 사용한 신고서나 신고 후 받은 접수증을 올려 주세요.', file: `${period}_신고서.pdf 또는 신고접수증.pdf` }
        : name.includes('지급명세')
          ? { description: '해당 기간의 지급명세서나 제출 후 받은 접수증을 올려 주세요.', file: `${period}_지급명세서.pdf 또는 제출접수증.pdf` }
          : { description: '이 업무의 작업 결과나 처리 사실을 확인할 수 있는 파일을 올려 주세요.', file: `${period}_업무결과.pdf 또는 작업내역.xlsx` }

  return (
    <div className="mt-3 border-t border-zinc-100 pt-3 text-xs leading-relaxed text-zinc-500">
      <p className="mb-1 font-medium text-zinc-700">처리 안내</p>
      {mode === 'check_only' ? (
        <p>{sourceName
          ? `먼저 ‘${sourceName}’ 업무에 파일을 등록하고 완료해 주세요. 연결된 자료로 이 업무를 처리한 뒤 완료를 눌러 주세요. 여기에는 파일을 다시 올리지 않습니다.`
          : '실제 업무를 마친 뒤 완료를 눌러 주세요. 파일은 올리지 않아도 됩니다.'}</p>
      ) : (
        <>
          <p>{example.description}</p>
          <p className="mt-1 break-words"><span className="text-zinc-600">파일 예시: </span>{example.file}</p>
          <p className="mt-1">{mode === 'file_and_notify'
            ? '파일을 등록하고 실제 전달까지 마친 뒤 완료를 눌러 주세요. 완료 버튼이 메일을 자동 발송하지는 않습니다.'
            : '파일 등록 후 완료를 눌러 주세요. 완료 후 파일을 바꾸려면 수정으로 전환해 주세요.'}</p>
        </>
      )}
    </div>
  )
}
