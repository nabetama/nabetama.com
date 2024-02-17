import { describe, test, expect } from 'vitest'
import { renderPost } from './post'
import { Post } from 'contentlayer/generated'
import { readFile } from 'fs/promises'
import { allPosts } from './post'

describe('render post', () => {
  test('renderPost()', async () => {
    // fsreadFile's arguments are the file path and the encoding
    // the file path is relative to the root of the project
    const postBodyRaw = await readFile('./content/posts/1999-01-01.mdx', 'utf-8')

    const post: Post = {
      _id: 'test-post',
      _raw: {
        sourceFilePath: 'dummy-sourceFilePath',
        sourceFileName: 'dummy-sourceFileName',
        sourceFileDir: 'dummy-sourceFileDir/',
        contentType: 'markdown',
        flattenedPath: '',
      },
      type: 'Post',
      title: 'dumy title',
      date: '1999-12-31T23:59:59.999Z',
      body: {
        raw: postBodyRaw,
        code: '',
      },
      slug: '',
      slugParams: '',
    }

    const renderedPost = await renderPost(post)

    expect(renderedPost.firstImageUrl).toBe('https://i.imgur.com/YC0BnRzm.png')
    expect(renderedPost.renderedHtml).toContain('<h1>H1 header</h1>')
  })
})

describe('allPosts', () => {
  test('allPosts() excludes submissions for a specific date', () => {
    const posts: Post[] = [
      {
        _id: 'test-post-1',
        _raw: {
          sourceFilePath: 'dummy-sourceFilePath',
          sourceFileName: 'dummy-sourceFileName',
          sourceFileDir: 'dummy-sourceFileDir/',
          contentType: 'markdown',
          flattenedPath: '',
        },
        type: 'Post',
        title: 'dumy title',
        date: '1999-12-31T23:59:59.999Z',
        body: {
          raw: '',
          code: '',
        },
        slug: '',
        slugParams: '',
      },
      {
        _id: 'test-post-2',
        _raw: {
          sourceFilePath: 'dummy-sourceFilePath',
          sourceFileName: 'dummy-sourceFileName',
          sourceFileDir: 'dummy-sourceFileDir/',
          contentType: 'markdown',
          flattenedPath: '',
        },
        type: 'Post',
        title: 'dumy title',
        date: '1999-01-31T23:59:59.999Z',
        body: {
          raw: '',
          code: '',
        },
        slug: '',
        slugParams: '',
      },
    ]

    const filteredPosts = allPosts(posts, '1999-12-31T23:59:59.999Z')
    expect(filteredPosts.length).toBe(1)
    expect(filteredPosts[0]._id).toBe('test-post-2')
  })
})
