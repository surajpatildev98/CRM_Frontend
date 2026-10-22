import type { JsonObject } from '../../api'

export type LoginPageProps = {
  onSuccess: (token: string, user: JsonObject) => void
}
