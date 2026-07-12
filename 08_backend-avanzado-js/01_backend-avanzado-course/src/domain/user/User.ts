import { Entity, EntityProps } from '../shared/Entity';

interface PartialUserProps {
  email: string;
  name: string;
  surname: string;
  password: string;
}

type UserProps = PartialUserProps & EntityProps;

export class User extends Entity {
  readonly email: string;
  readonly name: string;
  readonly surname: string;
  readonly password: string;

  constructor(props: UserProps) {
    super({ id: props.id, createdAt: props.createdAt, updatedAt: props.updatedAt });

    // initialize user props
    this.email = props.email;
    this.name = props.name;
    this.surname = props.surname;
    this.password = props.password;
  }
}
