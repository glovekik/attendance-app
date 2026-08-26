/**
 * Modal wrapper around PersonDetail — the tap-a-person gesture used from chat
 * and from the org browser on phones. Desktop renders PersonDetail directly in
 * a pane instead.
 */

import React from "react";

import { WebModal } from "./WebModal";
import { PersonDetail, ProfileSeed } from "./PersonDetail";

export type { ProfileSeed };

interface Props {
  person: ProfileSeed | null;
  onClose: () => void;
}

export const UserProfileSheet = ({ person, onClose }: Props) => (
  <WebModal
    visible={!!person}
    onClose={onClose}
    title="Profile"
    size="sm"
    scrollable
  >
    <PersonDetail person={person} />
  </WebModal>
);
