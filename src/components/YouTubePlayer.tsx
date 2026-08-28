import { useState } from 'react';

type Props = { videoId: string; title: string; thumbnailUrl: string };

export default function YouTubePlayer({ videoId, title, thumbnailUrl }: Props) {
  const [playing, setPlaying] = useState(false);
  if (playing) {
    return <iframe className="video-frame" src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`} title={title} allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen />;
  }
  return (
    <button className="video-poster" type="button" onClick={() => setPlaying(true)} aria-label={`Play ${title}`}>
      <img src={thumbnailUrl} alt="" loading="eager" />
      <span className="video-play" aria-hidden="true">▶</span>
      <span className="video-consent">Play on YouTube · Loads after your click</span>
    </button>
  );
}
