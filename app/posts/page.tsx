import { allPosts } from 'contentlayer/generated'
import { compareDesc } from 'date-fns'
import Link from 'next/link'

import { format } from 'date-fns'

export const metadata = {
  title: '記事一覧',
}

export default function Home() {
  const posts = allPosts.sort((a, b) => compareDesc(new Date(a.date), new Date(b.date)))

  return (
    <div className="prose dark:prose-invert">
      {posts.map((post) => (
        <article className="mt-10" key={post._id}>
          <time
            className="dark:text-gray-400 no-underline mt-3 p-0 block text-[.8rem]"
            dateTime={post.date}
          >
            {format(post.date, 'yyyy年MM月dd日')}
          </time>
          <Link className="text-xl" href={post.slug}>
            {post.title}
          </Link>
          {post.description && <p className="mt-2">{post.description}</p>}
        </article>
      ))}
    </div>
  )
}
