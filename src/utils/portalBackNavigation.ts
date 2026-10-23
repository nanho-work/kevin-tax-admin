/** Explicit screen hierarchy: URL depth alone does not imply a detail screen. */
export function getPortalBackPath(pathname: string, search?: { get: (key: string) => string | null }): string | null {
  const path = pathname.replace(/\/+$/, '')
  const portal = path.match(/^\/(admin|client)(?=\/|$)/)?.[0]
  if (!portal) return null
  const tail = path.slice(portal.length)
  const postQuery = () => {
    const query = new URLSearchParams()
    for (const key of ['post_type', 'board_id']) {
      const value = search?.get(key)
      if (value) query.set(key, value)
    }
    return query.size ? `?${query}` : ''
  }
  if (tail === '/companies/account/new') return `${portal}/companies/account`
  if (/^\/companies\/(new|bulk|\d+)$/.test(tail)) return `${portal}/companies`
  if (/^\/mail\/inbox\/[^/]+$/.test(tail) || tail === '/mail/compose') return `${portal}/mail/inbox`
  if (/^\/docs\/[^/]+$/.test(tail)) return `${portal}/docs`
  if (/^\/docs\/editor\/[^/]+$/.test(tail)) return `${portal}/docs`
  if (/^\/staff\/work-posts\/[^/]+\/edit$/.test(tail)) return path.replace(/\/edit$/, '') + postQuery()
  if (/^\/staff\/work-posts\/[^/]+$/.test(tail)) return `${portal}/staff/work-posts${postQuery()}`
  if (tail === '/staff/documents/new') return `${portal}/staff/documents`
  if (tail === '/staff/register') return `${portal}/staff`
  if (tail === '/office/staff/register') return `${portal}/office/staff`
  if (tail === '/client-management/create') return `${portal}/client-management/list`
  if (tail === '/client-management/company-create') return `${portal}/client-management/company-list`
  const blog = tail.match(/^(\/(?:office\/|client-management\/)?blog)\/([^/]+)$/)
  if (blog && blog[2] !== 'list') return `${portal}${blog[1]}/list`
  const debit = tail.match(/^(\/(?:office\/)?bookkeeping\/debits)\/(upload|history\/[^/]+|batches\/[^/]+)$/)
  if (debit) return `${portal}${debit[1]}/${debit[2] === 'upload' ? '' : 'history'}`.replace(/\/$/, '')
  if (tail === '/company-withholding/etc' || tail === '/company-withholding/earned-income') return `${portal}/company-withholding/business`
  return null
}
