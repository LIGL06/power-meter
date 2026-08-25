import { getHttpClient } from "@/lib/api";
import type { UpdateUserProfileDto, UserProfile } from "@/domain/types";

const client = getHttpClient();

export const usersRepository = {
  /** Admin, or the user themselves. */
  get(id: string) {
    return client.get<UserProfile>(`/users/${id}`).then((res) => res.data);
  },

  /** Admin, or the user themselves — `role`/`isActive` in `patch` are rejected (403) from a non-admin actor. */
  update(id: string, patch: UpdateUserProfileDto) {
    return client.patch<UserProfile>(`/users/${id}`, patch).then((res) => res.data);
  },
};
