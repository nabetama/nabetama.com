import { useMDXComponent } from 'next-contentlayer/hooks'
import { Image } from './image'

const components = {
  Image,
}

interface MdxProps {
  code: string
}

export function Mdx({ code }: MdxProps) {
  const MDXComponent = useMDXComponent(code)
  return <MDXComponent components={components} />
}
