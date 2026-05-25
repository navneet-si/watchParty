provider "aws" {
  region = "ap-south-1" 
}

resource "aws_security_group" "k3s_sg" {
  name        = "k3s-cluster-sg"
  description = "Allow Kubernetes, SSH, and Node traffic"

  # SSH
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # WebRTC Server
  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # K3s API
  ingress {
    from_port   = 6443
    to_port     = 6443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  # CRITICAL: Allow the 3 servers to talk to each other internally
  ingress {
    from_port = 0
    to_port   = 0
    protocol  = "-1"
    self      = true
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_instance" "k3s_nodes" {
  count         = 3
  ami           = "ami-0287a05f0ef0e9d9a" # Ubuntu 22.04
  instance_type = "t2.micro"              # FREE TIER GUARANTEE
  
  security_groups = [aws_security_group.k3s_sg.name]
  key_name        = "extensionServer" 

  tags = {
    Name = count.index == 0 ? "K3s-Master" : "K3s-Worker-${count.index}"
  }
}

# Print the IPs to the terminal when finished!
output "master_ip" {
  value = aws_instance.k3s_nodes[0].public_ip
}

output "worker_ips" {
  value = [aws_instance.k3s_nodes[1].public_ip, aws_instance.k3s_nodes[2].public_ip]
}