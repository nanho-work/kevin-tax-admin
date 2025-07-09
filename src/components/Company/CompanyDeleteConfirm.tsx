'use client'

import { useState, Fragment } from 'react'
import { deactivateCompany } from '@/services/company'
import { Dialog as HeadlessDialog, Transition } from '@headlessui/react'
import type { ButtonHTMLAttributes } from 'react'
import clsx from 'clsx'

interface CompanyDeleteConfirmProps {
  companyId: number
  companyName: string
  open: boolean
  onClose: () => void
  onDeleted: () => void
}

// ✅ Button 컴포넌트 정의
function Button({ variant = 'default', className, ...props }: ButtonProps) {
  const base =
    'px-4 py-2 rounded text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2'
  const variants = {
    default: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    destructive: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    outline:
      'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-gray-500',
  }
  return (
    <button className={clsx(base, variants[variant], className)} {...props} />
  )
}
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline'
}

// ✅ Dialog 관련 구성 요소 정의
function Dialog({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <Transition appear show={open} as={Fragment}>
      <HeadlessDialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-30" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <HeadlessDialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                {children}
              </HeadlessDialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </HeadlessDialog>
    </Transition>
  )
}

function DialogHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-lg font-semibold mb-4 ${className ?? ''}`}>{children}</div>
}

function DialogContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`mb-6 text-sm text-gray-600 ${className ?? ''}`}>{children}</div>
}

function DialogFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex justify-end gap-2 ${className ?? ''}`}>{children}</div>
}

// ✅ 실제 Confirm 컴포넌트 본체
export default function CompanyDeleteConfirm({
  companyId,
  companyName,
  open,
  onClose,
  onDeleted,
}: CompanyDeleteConfirmProps) {
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    try {
      await deactivateCompany(companyId)
      onDeleted()
      onClose()
    } catch (err) {
      console.error('삭제 실패:', err)
      alert('삭제에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent>
        <DialogHeader>회사 삭제</DialogHeader>
        <p>
          <strong>{companyName}</strong> 회사를 정말 삭제하시겠습니까?<br />
          삭제 시 복구할 수 없습니다.
        </p>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading ? '삭제 중...' : '삭제'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}