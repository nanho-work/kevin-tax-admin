const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const { JSDOM } = require('jsdom')
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' })
Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
const React = require('react')
const { createRoot } = require('react-dom/client')
const { Simulate } = require('react-dom/test-utils')
const { act } = React

function loadPanel(api, path = 'src/components/admin/workflow/TaskWorkPanel.tsx', docsApi = {}) {
  const wrapper = ({ children }) => React.createElement('div', null, children)
  const popover = React.createContext()
  const mocks = {
    '@headlessui/react': {
      Dialog: wrapper, DialogPanel: wrapper, DialogTitle: wrapper, DialogBackdrop: wrapper,
      Popover: ({ children }) => React.createElement(popover.Provider, { value: React.useState(false) }, children),
      PopoverButton: props => {
        const [open, setOpen] = React.useContext(popover)
        return React.createElement('button', { ...props, onClick: () => setOpen(!open) })
      },
      PopoverPanel: ({ children }) => React.useContext(popover)[0] ? wrapper({ children }) : null,
    },
    '@/services/workflowTaskBoard': { ...api, getTaskBoardErrorMessage: error => error.message },
    '@/services/admin/adminDocsService': docsApi,
    '@/contexts/ConfirmDialogContext': { useConfirmDialog: () => ({ confirm: async () => true }) },
    '@/utils/workflowCompletionSave': { workflowCompletionSave: { pending: null } },
    'react-hot-toast': { toast: { success() {}, error() {} } },
  }
  const load = file => {
    const exports = {}
    const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    })
    vm.runInNewContext(outputText, { exports, require: name => mocks[name] || require(name) })
    return exports
  }
  mocks['@/utils/dateTime'] = load('src/utils/dateTime.ts')
  mocks['./PayrollFilePreview'] = load('src/components/admin/workflow/PayrollFilePreview.tsx')
  return load(path).default
}

const company = { companyId: 12, companyName: '테스트 거래처', boardId: 45, month: '2026-08', itemId: 7, close() {} }
const button = text => [...document.querySelectorAll('button')].find(node => node.textContent === text)

test('file selection and drop upload to the same board item, then reload saved files', async () => {
  let docs = []
  let changed = 0
  const Panel = loadPanel({
    listTaskBoardItems: async () => ({ items: [{ id: 7, task_name: '원천세 신고', execution_mode_snapshot: 'file_only', status: 'not_started', target_active: true }] }),
    listTaskItemDocs: async (scope, companyId, boardId, itemId) => {
      assert.deepEqual([scope, companyId, boardId, itemId], ['admin', 12, 45, 7])
      return { items: docs }
    },
  })
  const root = createRoot(document.getElementById('root'))
  try {
    await act(async () => root.render(React.createElement(Panel, {
      ...company,
      upload: async (itemId, files, companyId, boardId) => {
        assert.deepEqual([itemId, companyId, boardId], [7, 12, 45])
        assert.deepEqual(Array.from(files, file => file.name), ['selected.pdf', 'dropped.pdf'])
        docs = [{ id: 1, docs_entry_id: 5, file_name: 'selected.pdf' }]
        return { total: 2, successCount: 1, failedCount: 1, failedIndexes: [1] }
      },
      onChanged: () => changed++,
    })))
    const input = document.querySelector('input[type=file]')
    Object.defineProperty(input, 'files', { value: [new window.File(['a'], 'selected.pdf')] })
    act(() => Simulate.change(input))
    act(() => Simulate.drop(input.parentElement, { dataTransfer: { files: [new window.File(['b'], 'dropped.pdf')] } }))
    await act(async () => Simulate.click(button('업로드')))
    assert.ok(button('selected.pdf'))
    assert.match(document.body.textContent, /dropped.pdf/)
    assert.equal(document.querySelectorAll('li').length, 2)
    assert.equal(changed, 1)
  } finally { act(() => root.unmount()) }
})

test('linked delivery reads source files and records completion on the delivery item', async () => {
  let status = 'not_started'
  const Panel = loadPanel({
    listTaskBoardItems: async () => ({ items: [{ id: 7, task_name: '납부서 전달', execution_mode_snapshot: 'check_only', source_item_id: 6, can_deliver: true, status, target_active: true }] }),
    listTaskItemDocs: async (_scope, _companyId, _boardId, itemId) => {
      assert.equal(itemId, 6)
      return { items: [{ id: 1, docs_entry_id: 5, file_name: '납부서.pdf' }] }
    },
  })
  const root = createRoot(document.getElementById('root'))
  try {
    await act(async () => root.render(React.createElement(Panel, {
      ...company,
      saveStatus: async (companyId, boardId, item, next) => {
        assert.deepEqual([companyId, boardId, item.id, next], [12, 45, 7, 'done'])
        status = next
      },
      onChanged() {},
    })))
    assert.ok(button('납부서.pdf'))
    assert.equal(document.querySelector('input[type=file]'), null)
    await act(async () => Simulate.click(button('전달 완료 기록')))
    assert.ok(button('완료 취소'))
  } finally { act(() => root.unmount()) }
})

test('payroll delivery previews a selected source spreadsheet and completes from the header', async () => {
  let status = 'not_started'
  const previews = []
  const Panel = loadPanel({
    listTaskBoardItems: async () => ({ items: [{ id: 7, task_name: '급여대장 송부 및 확인', execution_mode_snapshot: 'check_only', source_item_id: 6, can_deliver: true, status, target_active: true }] }),
    listTaskItemDocs: async (_scope, _companyId, _boardId, itemId) => {
      assert.equal(itemId, 6)
      return { items: [{ id: 1, docs_entry_id: 5, file_name: '급여대장.xlsx' }] }
    },
  }, undefined, {
    fetchAdminDocsSpreadsheetPreview: async (entryId, sheetIndex) => {
      previews.push([entryId, sheetIndex])
      return { sheets: ['1월', '2월'], rows: [[`급여 ${sheetIndex + 1}`]], truncated: false }
    },
  })
  const root = createRoot(document.getElementById('root'))
  try {
    await act(async () => root.render(React.createElement(Panel, {
      ...company, payrollDelivery: true,
      saveStatus: async (_companyId, _boardId, item, next) => {
        assert.equal(item.id, 7)
        status = next
      },
      onChanged() {},
    })))
    assert.deepEqual(previews, [])
    assert.ok(button('처리완료').compareDocumentPosition(button('급여대장.xlsx')) & window.Node.DOCUMENT_POSITION_FOLLOWING)
    await act(async () => Simulate.click(button('급여대장.xlsx')))
    assert.match(document.querySelector('table').textContent, /급여 1/)
    const select = document.querySelector('[aria-label="미리 볼 시트"]')
    select.value = '1'
    await act(async () => Simulate.change(select))
    assert.match(document.querySelector('table').textContent, /급여 2/)
    assert.deepEqual(previews, [[5, 0], [5, 1]])
    await act(async () => Simulate.click(button('처리완료')))
    assert.equal(status, 'done')
    assert.ok(button('완료 취소'))
  } finally { act(() => root.unmount()) }
})

test('payroll cell keeps successful files and dismisses an upload failure without another request', async () => {
  const docs = []
  const uploads = []
  const statuses = []
  let changed = 0
  const Cell = loadPanel({
    listTaskItemDocs: async (...args) => {
      assert.deepEqual(args, ['admin', 12, 45, 7])
      return { items: [...docs] }
    },
    deleteTaskItemFile: async (...args) => {
      assert.deepEqual(args, ['admin', 12, 45, 7, docs[0].docs_entry_id])
      docs.shift()
    },
    updateTaskBoardItem: async (scope, companyId, boardId, itemId, payload) => {
      assert.deepEqual([scope, companyId, boardId, itemId], ['admin', 12, 45, 7])
      statuses.push(payload.status)
    },
  }, 'src/components/admin/workflow/PayrollFilesCell.tsx')
  const root = createRoot(document.getElementById('root'))
  const props = {
    ...company, fileCount: 0, disabled: false,
    upload: async (itemId, files, companyId, boardId) => {
      assert.deepEqual([itemId, companyId, boardId], [7, 12, 45])
      uploads.push(Array.from(files, file => file.name))
      docs.push({ id: docs.length + 1, docs_entry_id: docs.length + 20, file_name: files[0].name, created_at: `2026-08-1${docs.length}T16:00:00` })
      return { successCount: 1, failedCount: files.length - 1, failedIndexes: files.length > 1 ? [1] : [] }
    },
    onChanged: () => changed++,
  }
  try {
    await act(async () => root.render(React.createElement(Cell, props)))
    const drop = document.querySelector('input[type=file]').parentElement
    await act(async () => Simulate.drop(drop, {
      dataTransfer: { files: [new window.File(['a'], '8월 급여대장.xlsx'), new window.File(['b'], '급여명세서.pdf')] },
    }))
    assert.ok(button('8월 급여대장.xlsx'))
    assert.equal(button('작성 완료'), undefined)
    assert.equal(button('파일 선택 · 드롭'), undefined)
    assert.ok(drop.classList.contains('border-emerald-500'))
    assert.deepEqual(statuses, [])
    const failure = document.querySelector('[role="status"][title]')
    assert.match(failure.title, /급여명세서.pdf/)
    assert.equal(button('실패 1건 재시도'), undefined)
    await act(async () => Simulate.click(document.querySelector('[aria-label="업로드 실패 표시 닫기"]')))
    assert.equal(document.querySelector('[role="status"][title]'), null)
    assert.equal(uploads.length, 1)
    await act(async () => Simulate.drop(drop, {
      dataTransfer: { files: [new window.File(['b'], '급여명세서.pdf')] },
    }))
    assert.deepEqual(uploads, [['8월 급여대장.xlsx', '급여명세서.pdf'], ['급여명세서.pdf']])
    const multiple = button('급여명세서.pdf외 1건')
    assert.ok(multiple)
    assert.match(drop.textContent, /26\.08\.12/)
    assert.equal(document.querySelector('[aria-label="급여명세서.pdf 삭제"]'), null)
    act(() => Simulate.click(multiple))
    assert.ok(button('급여명세서.pdf'))
    assert.deepEqual(statuses, ['done'])
    await act(async () => Simulate.click(document.querySelector('[aria-label="8월 급여대장.xlsx 삭제"]')))
    assert.equal(button('8월 급여대장.xlsx'), undefined)
    await act(async () => Simulate.click(document.querySelector('[aria-label="급여명세서.pdf 삭제"]')))
    assert.deepEqual(statuses, ['done', 'done', 'not_started'])
    assert.equal(changed, 4)
    assert.ok(button('파일 선택 · 드롭'))
    assert.equal(drop.classList.contains('border-emerald-500'), false)
  } finally { act(() => root.unmount()) }
})
