export const PROFILE_IMAGE_UPDATED_EVENT = 'profile-image-updated'

export type ProfileImageUpdatedDetail = {
  actorType?: 'admin' | 'client_account' | 'company_account'
  actorId?: number
  at?: number
}

export function emitProfileImageUpdated(detail?: ProfileImageUpdatedDetail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<ProfileImageUpdatedDetail>(PROFILE_IMAGE_UPDATED_EVENT, {
      detail: {
        at: Date.now(),
        ...detail,
      },
    })
  )
}
