type Props = { videoId: string; title: string; thumbnailUrl: string };

export default function YouTubePlayer({ videoId, title }: Props) {
  return <iframe className="video-frame" src={`https://www.youtube-nocookie.com/embed/${videoId}`} title={title} allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen />;
}
