# To learn more about how to use Nix to configure your environment
# see: https://developers.google.com/idx/guides/customize-idx-env
{
  pkgs,
  ...
}: # This defines the arguments received by the environment configuration
{
  # Which nixpkgs channel to use.
  channel = "stable-24.05"; # or "unstable"

  # Use https://search.nixos.org/packages to find packages
  packages = [
    pkgs.nodejs_20
  ];

  # Sets environment variables in the workspace
  env = {
    GMAIL_EMAIL = "invincibleshinmen@gmail.com"; # Ensure this is your correct email
    GMAIL_PASSWORD = "qzyl czow daei xabj"; # !!! IMPORTANT: Replace with your actual App Password if 2FA is enabled !!!
  };

  idx = {
    # Search for the extensions you want on https://open-vsx.org/ and use "publisher.id"
    extensions = [
      "google.gemini-cli-vscode-ide-companion"
    ];

    # Enable previews
    previews = {
      enable = true;
      previews = {
        web = {
          # This command starts the Next.js app in the web preview panel.
          # The $PORT environment variable is provided by the environment and passed directly.
          command = ["sh" "-c" "PORT=$PORT npm run dev --prefix vibez"];
          manager = "web";
        };
      };
    };

    # Workspace lifecycle hooks
    workspace = {
      # Runs when a workspace is first created
      onCreate = {
        npm-install = "npm install --prefix vibez";
        default.openFiles = [ ".idx/dev.nix" "README.md" ];
      };
      # The Next.js dev server is now started via the 'previews' command, so this can be empty.
      onStart = {};
    };
  };
}
