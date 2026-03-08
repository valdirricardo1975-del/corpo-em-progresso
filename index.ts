export type ProfileKey = 'voce' | 'esposa';

export type Profile = {
  key: ProfileKey;
  nome: string;
  alturaCm?: number;
  metaPeso?: number;
};

export type Entry = {
  id: string;
  date: string;
  peso?: number;
  gordura?: number;
  cintura?: number;
  quadril?: number;
  braco?: number;
  coxa?: number;
  observacoes?: string;
  photoUri?: string;
  createdAt: string;
};

export type AppData = {
  activeProfile: ProfileKey;
  profiles: Record<ProfileKey, Profile>;
  entries: Record<ProfileKey, Entry[]>;
};
