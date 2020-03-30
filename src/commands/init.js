const { Command, flags } = require('@oclif/command')
const fs = require('fs');
const { exec } = require('child_process');
const crypto = require('crypto');

const composeContent = `version: '3.6'
services:
  nhost-postgres:
    image: postgres:{{ postgres_version }}
    ports:
      - '{{ postgres_port }}:{{ postgres_port }}'
    restart: always
    environment:
      POSTGRES_USER: {{ postgres_password }}
      POSTGRES_PASSWORD: {{ postgres_password }}
    volumes:
      - ./db_data:/var/lib/postgresql/data
  nhost-graphql-engine:
    image: hasura/graphql-engine:v1.1.0.cli-migrations
    ports:
      - '{{ graphql_server_port }}:{{ graphql_server_port }}'
    depends_on:
      - nhost-postgres
    restart: always
    environment:
      HASURA_GRAPHQL_SERVER_PORT: {{ graphql_server_port }}
      HASURA_GRAPHQL_DATABASE_URL: postgres://{{ postgres_user }}:{{ postgres_password }}@nhost-postgres:{{ postgres_port }}/postgres
      HASURA_GRAPHQL_ENABLE_CONSOLE: 'false'
      HASURA_GRAPHQL_ENABLED_LOG_TYPES: startup, http-log, webhook-log, websocket-log, query-log
      HASURA_GRAPHQL_ADMIN_SECRET: {{ graphql_admin_secret }}
      HASURA_GRAPHQL_JWT_SECRET: '{"type":"HS256", "key": "50a06d3b2b5114a164b66dec15db14214c585426bc67f7329679b53a2758029a9ce7894c3f464e8adac860ecaa50fa1ae1bb079c393f9360706adc047170f12d"}'
      SECRET_WEBHOOK_HEADER: f3580e0add74a540c7261f6f4ee22dc8836837b29acd9a3618ebbeea91fd7ee5
    command:
      - graphql-engine
      - serve
    volumes:
      - './migrations:/hasura-migrations'
  hasura-backend-plus:
    image: elitan/hasura-backend-plus:v1.1.1
    depends_on:
    - nhost-graphql-engine
    restart: always
    environment:
      PORT: 9000
      USER_FIELDS: ''
      USER_REGISTRATION_AUTO_ACTIVE: 'true'
      HASURA_GRAPHQL_ENDPOINT: http://nhost-graphql-engine:{{ graphql_server_port }}/v1/graphql
      HASURA_GRAPHQL_ADMIN_SECRET: {{ graphql_admin_secret }}
      HASURA_GRAPHQL_JWT_SECRET: '{"type":"HS256", "key": "51a06d3b2b5114a164b66dec15db14214c585426bc67f7329679b53a2758029a9ce7894c3f464e8adac860ecaa50fa1ae1bb079c393f9360706adc047170f12d"}'
      AUTH_ACTIVE: 'true'
      AUTH_LOCAL_ACTIVE: 'true'
      AUTH_GITHUB_ACTIVE: 'true'
      AUTH_GITHUB_CLIENT_ID: 'aee57448edd447dc3379'
      AUTH_GITHUB_CLIENT_SECRET: 'cd406c0a99ee6883a64264d72bcaea454cae6d83'
      AUTH_GITHUB_CALLBACK_URL: 'http://localhost:9000/auth/github/callback'
      AUTH_GOOGLE_ACTIVE: 'false'
      AUTH_FACEBOOK_ACTIVE: 'false'
      PROVIDERS_SUCCESS_REDIRECT: 'http://localhost:3000'
      REFRESH_TOKEN_EXPIRES: 43200
      JWT_TOKEN_EXPIRES: 15
    ports:
      - 9000:9000
`;

class InitCommand extends Command {
  getConfigData(admin_secret) {
    let configData = `# The values here will be used by 'nhost dev' to start your dev environment

# hasura graphql configuration
graphql_version: v1.1.0.cli-migrations
graphql_server_port: 8080
graphql_admin_secret: ${admin_secret} 

# postgres configuration
postgres_version: 12.0
postgres_port: 5432
postgres_user: postgres
postgres_password: postgres
`
    return configData;
  }

  async run() {
    const {flags} = this.parse(InitCommand)
    const directory = flags.directory || 'nhost_project'

    // make sure the provided directory does not exist
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory);
    } else {
      return this.log('Directory already exists');
    }

    // create docker-compose.yaml 
    const dockerComposeFile = `./${directory}/docker-compose.example`; 
    fs.writeFileSync(dockerComposeFile, composeContent);
    this.log(`${dockerComposeFile} created`);

    // create the migrations directory for hasura
    const migrationsDir = `./${directory}/migrations`;
    fs.mkdirSync(migrationsDir);
    this.log(`${migrationsDir} directory created...`);

    const configYamlFile = `./${directory}/config.yaml`;
    fs.writeFileSync(
      configYamlFile, 
      this.getConfigData(crypto.randomBytes(32).toString('hex').slice(0, 32))
    );
    this.log(`${configYamlFile} created`);

    // finally check if hasura's CLI is installed
    exec('command -v hasura', (error) => {
      if (error) {
        this.log('The hasura CLI is a dependency. Please check out the installation instructions here https://hasura.io/docs/1.0/graphql/manual/hasura-cli/install-hasura-cli.html');
      }
    });
  }
}

InitCommand.description = `Describe the command here
...
Extra documentation goes here
`

InitCommand.flags = {
  directory: flags.string({char: 'd', description: 'directory where to create the files'}),
}

module.exports = InitCommand
