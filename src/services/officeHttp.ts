import { adminHttp, clientHttp } from './http'
// Opt-in adapter for APIs explicitly accepting office-manager authentication.
export const officeHttp: typeof clientHttp = new Proxy(clientHttp, {
  get(_target, key) {
    const http = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin/office') ? adminHttp : clientHttp
    const value = Reflect.get(http, key)
    return typeof value === 'function' ? value.bind(http) : value
  },
  apply(_target, _this, args) {
    const http = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin/office') ? adminHttp : clientHttp
    return Reflect.apply(http, http, args)
  },
})
