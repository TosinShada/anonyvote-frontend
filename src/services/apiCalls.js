import { getRequest, putRequest, postRequest } from './axiosClient'

export function getPolls() {
  return getRequest('/api/v1/polls')
}

export function vote(id, payload) {
  return putRequest(`/api/v1/polls/${id}`, payload)
}

export function createPoll(payload) {
  return postRequest('/api/v1/polls', payload)
}
