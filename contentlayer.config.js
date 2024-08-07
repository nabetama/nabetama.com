import { defineDocumentType, makeSource } from 'contentlayer2/source-files'

/** @type {import('contentlayer2/source-files').ComputedFields} */
const computedFields = {
  slug: {
    type: 'string',
    resolve: (doc) => `/${doc._raw.flattenedPath}`,
  },
  slugParams: {
    type: 'string',
    resolve: (doc) => doc._raw.flattenedPath.split('/').slice(1).join('/'),
  },
}

export const Page = defineDocumentType(() => ({
  name: 'Page',
  filePathPattern: `pages/**/*.mdx`,
  contentType: 'mdx',
  fields: {
    title: { type: 'string', required: true },
    description: { type: 'string' },
  },
  computedFields,
}))

export const Post = defineDocumentType(() => ({
  name: 'Post',
  filePathPattern: `posts/**/*.mdx`,
  contentType: 'mdx',
  fields: {
    title: { type: 'string', required: true },
    date: { type: 'date', required: true },
    lastModDate: { type: 'date' },
    tags: { type: 'list', of: { type: 'string' } },
    description: {
      type: 'string',
    },
  },
  computedFields,
}))

export default makeSource({ contentDirPath: './content', documentTypes: [Post, Page] })
