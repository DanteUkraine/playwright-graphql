import { DocumentNode } from 'graphql';
import gql from 'graphql-tag';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };

// Об'єкт із значеннями ролей користувача як const
export const Role = {
    ADMIN: 'ADMIN',
    USER: 'USER',
    GUEST: 'GUEST'
} as const;

// Тип, який походить від ключів об'єкта Role
export type Role = typeof Role[keyof typeof Role];

/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
    ID: { input: string; output: string; }
    String: { input: string; output: string; }
    Boolean: { input: boolean; output: boolean; }
    Int: { input: number; output: number; }
    Float: { input: number; output: number; }
};

export type Group = {
    __typename?: 'Group';
    _id?: Maybe<Scalars['String']['output']>;
    name?: Maybe<Scalars['String']['output']>;
};

export type Query = {
    __typename?: 'Query';
    group?: Maybe<Group>;
    groups?: Maybe<Array<Maybe<Group>>>;
    user?: Maybe<User>;
    users?: Maybe<Array<Maybe<User>>>;
};


export type QueryGroupArgs = {
    id: Scalars['String']['input'];
};


export type QueryUserArgs = {
    id: Scalars['String']['input'];
    role?: InputMaybe<Role>;
};


export type QueryUsersArgs = {
    role?: InputMaybe<Role>;
};

export type User = {
    __typename?: 'User';
    _id?: Maybe<Scalars['String']['output']>;
    group?: Maybe<Group>;
    username?: Maybe<Scalars['String']['output']>;
    role?: Maybe<Role>;
};

export type GroupQueryVariables = Exact<{
    id: Scalars['String']['input'];
}>;


export type GroupQuery = { __typename?: 'Query', group?: { __typename?: 'Group', _id?: string | null, name?: string | null } | null };

export type GroupsQueryVariables = Exact<{ [key: string]: never; }>;


export type GroupsQuery = { __typename?: 'Query', groups?: Array<{ __typename?: 'Group', _id?: string | null, name?: string | null } | null> | null };

export type UserQueryVariables = Exact<{
    id: Scalars['String']['input'];
    role?: InputMaybe<Role>;
}>;


export type UserQuery = { __typename?: 'Query', user?: { __typename?: 'User', _id?: string | null, username?: string | null, role?: Role | null, group?: { __typename?: 'Group', _id?: string | null, name?: string | null } | null } | null };

export type UsersQueryVariables = Exact<{
    role?: InputMaybe<Role>;
}>;


export type UsersQuery = { __typename?: 'Query', users?: Array<{ __typename?: 'User', _id?: string | null, username?: string | null, role?: Role | null, group?: { __typename?: 'Group', _id?: string | null, name?: string | null } | null } | null> | null };


export const GroupDocument = gql`
    query group($id: String!) {
  group(id: $id) {
    _id
    name
  }
}
    `;
export const GroupsDocument = gql`
    query groups {
  groups {
    _id
    name
  }
}
    `;
export const UserDocument = gql`
    query user($id: String!, $role: String) {
  user(id: $id, role: $role) {
    _id
    username
    role
    group {
      _id
      name
    }
  }
}
    `;
export const UsersDocument = gql`
    query users($role: String) {
  users(role: $role) {
    _id
    username
    role
    group {
      _id
      name
    }
  }
}
    `;
export type Requester<C = {}> = <R, V>(doc: DocumentNode, vars?: V, options?: C) => Promise<R> | AsyncIterable<R>
export function getSdk<C>(requester: Requester<C>) {
    return {
        group(variables: GroupQueryVariables, options?: C): Promise<GroupQuery> {
            return requester<GroupQuery, GroupQueryVariables>(GroupDocument, variables, options) as Promise<GroupQuery>;
        },
        groups(variables?: GroupsQueryVariables, options?: C): Promise<GroupsQuery> {
            return requester<GroupsQuery, GroupsQueryVariables>(GroupsDocument, variables, options) as Promise<GroupsQuery>;
        },
        user(variables: UserQueryVariables, options?: C): Promise<UserQuery> {
            return requester<UserQuery, UserQueryVariables>(UserDocument, variables, options) as Promise<UserQuery>;
        },
        users(variables?: UsersQueryVariables, options?: C): Promise<UsersQuery> {
            return requester<UsersQuery, UsersQueryVariables>(UsersDocument, variables, options) as Promise<UsersQuery>;
        }
    };
}
export type Sdk = ReturnType<typeof getSdk>
