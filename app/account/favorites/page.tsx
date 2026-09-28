"use client";

import { AccountShell } from "../../components/account-shell";
import { FavoritesList } from "../../components/favorites-list";

// Favorites (Handoff v12 2c): saved products, newest first. Guest favorites merge in on sign-in (FavoritesProvider).
export default function FavoritesPage() {
  return <AccountShell title="Favorites">{() => <FavoritesList />}</AccountShell>;
}
