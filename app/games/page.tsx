import ListingPage from "../components/listing-page";

// All game keys; genre / platform pages are this page with filters (/games?genre=FPS, /games?platform=Steam).
export default function GamesPage() {
  return <ListingPage scope="games" />;
}
