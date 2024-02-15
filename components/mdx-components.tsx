import { useMDXComponent } from 'next-contentlayer/hooks'

export function Image({ src, alt }: { src: string; alt: string }) {
  return (
    <figure>
      <img src={src} alt={alt} width={640} height={360} />
      <figcaption className="text-center text-xs">{alt}</figcaption>
    </figure>
  )
}

const components = {
  Image,
}

interface MdxProps {
  code: string
}

export function Mdx({ code }: MdxProps) {
  const Component = useMDXComponent(code)
  return <Component components={components} />
}
