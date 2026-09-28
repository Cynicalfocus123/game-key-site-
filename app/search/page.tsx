import ListingPage from "../components/listing-page";

// Search results (future task S2): /search?q= plus the same filters as every listing page.
export default function SearchPage() {
  return <ListingPage scope="search" />;
}
