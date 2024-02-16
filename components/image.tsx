export function Image({ src, alt }: { src: string; alt: string }) {
  return (
    <figure className="my-8 mx-0">
      <img className="mb-2" src={src} alt={alt} width={640} height={360} />
      <figcaption className="text-center text-xs">{alt}</figcaption>
    </figure>
  )
}
