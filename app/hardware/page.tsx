import ListingPage from "../components/listing-page";

// PC hardware listing. Game-only filters (operating system, platform, region) have no values here, so they stay hidden.
export default function HardwarePage() {
  return <ListingPage scope="hardware" />;
}
