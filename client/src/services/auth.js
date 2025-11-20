import { AuthAPI } from './api';

const USER_KEY = 'workradius:user';

export const saveUser = (user) => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const getStoredUser = () => {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
};

export const clearUser = () => {
  localStorage.removeItem(USER_KEY);
};

export const loginUser = async (credentials) => {
  const { data } = await AuthAPI.login(credentials);
  saveUser(data.user);
  return data.user;
};

export const registerUser = async (payload) => {
  await AuthAPI.register(payload);
};

export const fetchMe = async () => {
  const { data } = await AuthAPI.me();
  saveUser(data.user);
  return data.user;
};

export const logoutUser = async () => {
  await AuthAPI.logout();
  clearUser();
};

